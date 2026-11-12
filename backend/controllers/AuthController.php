<?php
/**
 * Authentication Controller
 * Digital LEAP Internship Management System
 *
 * Handles: register, login, logout, unlock account.
 *
 * Security rules implemented:
 * - Passwords hashed with PASSWORD_BCRYPT (NFR-02)
 * - Account locked after 3 failed attempts (NFR-02 / D-05)
 * - Auto-unlock after 30 minutes (D-05)
 * - Manual unlock by coordinator or admin (D-05)
 * - All lock/unlock/login events written to audit_logs (NFR-06)
 * - New accounts start with status = 'pending' (FR-02)
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../utils/Validator.php';
require_once __DIR__ . '/../utils/AuditLog.php';
require_once __DIR__ . '/../middleware/Auth.php';

class AuthController {

    private PDO      $db;
    private AuditLog $audit;

    // Lock configuration (D-05)
    private const MAX_ATTEMPTS   = 3;
    private const LOCKOUT_MINUTES = 30;

    public function __construct(PDO $db) {
        $this->db    = $db;
        $this->audit = new AuditLog($db);
    }

    /**
     * POST /auth/register
     * Registers a new user. Account starts as 'pending' until approved by Coordinator (FR-02).
     */
    public function register(): void {
        $body = $this->getJsonBody();

        $v = new Validator();
        $v->required($body['full_name']  ?? null, 'full_name')
          ->maxLength($body['full_name'] ?? '', 'full_name', 150)
          ->required($body['email']      ?? null, 'email')
          ->email($body['email']         ?? null, 'email')
          ->required($body['password']   ?? null, 'password')
          ->minLength($body['password']  ?? '', 'password', 8)
          ->required($body['role']       ?? null, 'role')
          ->inList($body['role'] ?? null, 'role', [
              'student',
              'academic_supervisor',
              'faculty_coordinator',
              'faculty_mentor',
              'host_supervisor',
              // leap_coordinator and management are created by admin only
          ]);

        if (!$v->passes()) {
            Response::error('Validation failed.', 422, $v->errors());
        }

        // Check for duplicate email
        $stmt = $this->db->prepare('SELECT user_id FROM users WHERE email = :email');
        $stmt->execute([':email' => strtolower(trim($body['email']))]);
        if ($stmt->fetch()) {
            Response::error('An account with this email address already exists.', 409);
        }

        // Hash password — never store plaintext
        $hash = password_hash($body['password'], PASSWORD_BCRYPT, ['cost' => 12]);

        $this->db->beginTransaction();
        try {
            // Insert user
            $stmt = $this->db->prepare(
                'INSERT INTO users (full_name, email, password_hash, status, created_at, updated_at)
                 VALUES (:full_name, :email, :password_hash, \'pending\', NOW(), NOW())'
            );
            $stmt->execute([
                ':full_name'     => trim($body['full_name']),
                ':email'         => strtolower(trim($body['email'])),
                ':password_hash' => $hash,
            ]);
            $user_id = (int) $this->db->lastInsertId();

            // Assign role
            $role_stmt = $this->db->prepare(
                'SELECT role_id FROM roles WHERE role_name = :role_name'
            );
            $role_stmt->execute([':role_name' => $body['role']]);
            $role = $role_stmt->fetch();

            if (!$role) {
                throw new RuntimeException('Role not found: ' . $body['role']);
            }

            $ur_stmt = $this->db->prepare(
                'INSERT INTO user_roles (user_id, role_id, assigned_at)
                 VALUES (:user_id, :role_id, NOW())'
            );
            $ur_stmt->execute([
                ':user_id' => $user_id,
                ':role_id' => $role['role_id'],
            ]);

            $this->db->commit();

            $this->audit->log($user_id, 'user_registered', 'user', $user_id, [
                'email' => strtolower(trim($body['email'])),
                'role'  => $body['role'],
            ]);

            Response::success(
                ['user_id' => $user_id],
                'Registration successful. Your account is pending coordinator approval.',
                201
            );

        } catch (Exception $e) {
            $this->db->rollBack();
            error_log('AuthController::register error: ' . $e->getMessage());
            Response::serverError();
        }
    }

    /**
     * POST /auth/login
     * Authenticates a user and returns a session token.
     * Enforces lockout after MAX_ATTEMPTS failures (NFR-02 / D-05).
     */
    public function login(): void {
        $body = $this->getJsonBody();

        $v = new Validator();
        $v->required($body['email']    ?? null, 'email')
          ->email($body['email']       ?? null, 'email')
          ->required($body['password'] ?? null, 'password');

        if (!$v->passes()) {
            Response::error('Validation failed.', 422, $v->errors());
        }

        $email = strtolower(trim($body['email']));

        $stmt = $this->db->prepare(
            'SELECT user_id, full_name, email, password_hash, status,
                    failed_attempts, locked_at
             FROM   users
             WHERE  email = :email'
        );
        $stmt->execute([':email' => $email]);
        $user = $stmt->fetch();

        // Generic message prevents user enumeration
        $generic_error = 'Invalid email or password.';

        if (!$user) {
            Response::error($generic_error, 401);
        }

        $user_id = (int) $user['user_id'];

        // Check if account is locked and handle auto-unlock (D-05)
        if ($user['status'] === 'locked') {
            if ($user['locked_at'] !== null) {
                $locked_time  = new DateTime($user['locked_at']);
                $unlock_after = (clone $locked_time)->modify('+' . self::LOCKOUT_MINUTES . ' minutes');
                $now          = new DateTime();

                if ($now >= $unlock_after) {
                    // Auto-unlock: 30 minutes have passed
                    $this->unlockUser($user_id, null, 'auto_unlock_30min');
                    // Reload user record after unlock
                    $stmt->execute([':email' => $email]);
                    $user = $stmt->fetch();
                } else {
                    $remaining = $now->diff($unlock_after);
                    $this->audit->log($user_id, 'login_blocked_locked', 'user', $user_id);
                    Response::error(
                        'Account is temporarily locked. Try again in ' .
                        $remaining->i . ' minute(s).',
                        403
                    );
                }
            }
        }

        // Check account status
        if ($user['status'] === 'pending') {
            Response::error('Your account is pending approval by the coordinator.', 403);
        }

        if ($user['status'] === 'suspended') {
            Response::error('Your account has been suspended. Contact the coordinator.', 403);
        }

        // Verify password
        if (!password_verify($body['password'], $user['password_hash'])) {
            $this->handleFailedAttempt($user_id, (int) $user['failed_attempts']);
            Response::error($generic_error, 401);
        }

        // Successful login — reset failed attempts
        $this->db->prepare(
            'UPDATE users SET failed_attempts = 0, updated_at = NOW() WHERE user_id = :id'
        )->execute([':id' => $user_id]);

        // Create session token
        $token      = Auth::generateToken();
        $expires_at = date('Y-m-d H:i:s', strtotime('+8 hours'));

        $this->db->prepare(
            'INSERT INTO user_sessions (user_id, token, expires_at, created_at)
             VALUES (:user_id, :token, :expires_at, NOW())'
        )->execute([
            ':user_id'    => $user_id,
            ':token'      => $token,
            ':expires_at' => $expires_at,
        ]);

        $roles = Auth::getUserRoles($user_id);

        $this->audit->log($user_id, 'login_success', 'user', $user_id);

        Response::success([
            'token'      => $token,
            'expires_at' => $expires_at,
            'user' => [
                'user_id'   => $user_id,
                'full_name' => $user['full_name'],
                'email'     => $user['email'],
                'roles'     => $roles,
            ],
        ], 'Login successful.');
    }

    /**
     * POST /auth/logout
     * Invalidates the current session token.
     */
    public function logout(): void {
        $user = Auth::requireAuth();

        $token = $this->extractBearerToken();

        $this->db->prepare(
            'DELETE FROM user_sessions WHERE token = :token'
        )->execute([':token' => $token]);

        $this->audit->log((int) $user['user_id'], 'logout', 'user', (int) $user['user_id']);

        Response::success(null, 'Logged out successfully.');
    }

    /**
     * POST /auth/unlock/{user_id}
     * Manual account unlock by an authorised Coordinator or Management user (D-05).
     */
    public function manualUnlock(int $target_user_id): void {
        $actor = Auth::requireRole(['leap_coordinator', 'management']);

        $stmt = $this->db->prepare(
            'SELECT user_id, status FROM users WHERE user_id = :id'
        );
        $stmt->execute([':id' => $target_user_id]);
        $target = $stmt->fetch();

        if (!$target) {
            Response::notFound('User not found.');
        }

        if ($target['status'] !== 'locked') {
            Response::error('This account is not currently locked.', 400);
        }

        $this->unlockUser($target_user_id, (int) $actor['user_id'], 'manual_unlock_by_coordinator');

        Response::success(null, 'Account has been unlocked successfully.');
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Increment failed login attempts and lock the account after MAX_ATTEMPTS.
     */
    private function handleFailedAttempt(int $user_id, int $current_attempts): void {
        $new_attempts = $current_attempts + 1;

        if ($new_attempts >= self::MAX_ATTEMPTS) {
            $this->db->prepare(
                'UPDATE users
                 SET    failed_attempts = :attempts,
                        status          = \'locked\',
                        locked_at       = NOW(),
                        updated_at      = NOW()
                 WHERE  user_id = :id'
            )->execute([':attempts' => $new_attempts, ':id' => $user_id]);

            $this->audit->log($user_id, 'account_locked', 'user', $user_id, [
                'reason' => 'max_failed_attempts',
            ]);
        } else {
            $this->db->prepare(
                'UPDATE users
                 SET    failed_attempts = :attempts,
                        updated_at      = NOW()
                 WHERE  user_id = :id'
            )->execute([':attempts' => $new_attempts, ':id' => $user_id]);

            $this->audit->log($user_id, 'login_failed', 'user', $user_id, [
                'attempt' => $new_attempts,
            ]);
        }
    }

    /**
     * Reset a locked account back to active status.
     */
    private function unlockUser(int $user_id, ?int $unlocked_by, string $reason): void {
        $this->db->prepare(
            'UPDATE users
             SET    status          = \'active\',
                    failed_attempts = 0,
                    locked_at       = NULL,
                    updated_at      = NOW()
             WHERE  user_id = :id'
        )->execute([':id' => $user_id]);

        $this->audit->log($unlocked_by ?? $user_id, 'account_unlocked', 'user', $user_id, [
            'reason'      => $reason,
            'unlocked_by' => $unlocked_by,
        ]);
    }

    /**
     * Parse JSON request body.
     */
    private function getJsonBody(): array {
        $raw = file_get_contents('php://input');
        return json_decode($raw, true) ?? [];
    }

    /**
     * Extract Bearer token from Authorization header.
     */
    private function extractBearerToken(): ?string {
        $header = $_SERVER['HTTP_AUTHORIZATION']
            ?? apache_request_headers()['Authorization']
            ?? null;

        if ($header && preg_match('/^Bearer\s+(.+)$/i', $header, $matches)) {
            return $matches[1];
        }
        return null;
    }
}

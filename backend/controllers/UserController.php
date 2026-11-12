<?php
/**
 * User Controller
 * Digital LEAP Internship Management System
 *
 * Handles: list pending accounts, approve/suspend accounts,
 *          get user profile, update profile, eligibility verification.
 *
 * FR-02: Coordinator approves student and host accounts.
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../utils/Validator.php';
require_once __DIR__ . '/../utils/AuditLog.php';
require_once __DIR__ . '/../middleware/Auth.php';

class UserController {

    private PDO      $db;
    private AuditLog $audit;

    public function __construct(PDO $db) {
        $this->db    = $db;
        $this->audit = new AuditLog($db);
    }

    /**
     * GET /users/pending
     * List accounts awaiting coordinator approval.
     * Roles: leap_coordinator
     */
    public function listPending(): void {
        Auth::requireRole(['leap_coordinator']);

        $stmt = $this->db->prepare(
            'SELECT u.user_id, u.full_name, u.email, u.status, u.created_at,
                    GROUP_CONCAT(r.role_name) AS roles
             FROM   users u
             JOIN   user_roles ur ON ur.user_id = u.user_id
             JOIN   roles r       ON r.role_id  = ur.role_id
             WHERE  u.status = \'pending\'
             GROUP  BY u.user_id
             ORDER  BY u.created_at ASC'
        );
        $stmt->execute();
        $users = $stmt->fetchAll();

        foreach ($users as &$u) {
            $u['roles'] = explode(',', $u['roles']);
        }

        Response::success($users, 'Pending accounts retrieved.');
    }

    /**
     * PATCH /users/{id}/status
     * Approve, suspend, or reactivate a user account.
     * Roles: leap_coordinator, management
     */
    public function updateStatus(int $target_id): void {
        $actor = Auth::requireRole(['leap_coordinator', 'management']);
        $body  = $this->getJsonBody();

        $v = new Validator();
        $v->required($body['status'] ?? null, 'status')
          ->inList($body['status'] ?? null, 'status', ['active', 'suspended', 'pending']);

        if (!$v->passes()) {
            Response::error('Validation failed.', 422, $v->errors());
        }

        $stmt = $this->db->prepare(
            'SELECT user_id, status FROM users WHERE user_id = :id'
        );
        $stmt->execute([':id' => $target_id]);
        $target = $stmt->fetch();

        if (!$target) {
            Response::notFound('User not found.');
        }

        $this->db->prepare(
            'UPDATE users SET status = :status, updated_at = NOW() WHERE user_id = :id'
        )->execute([':status' => $body['status'], ':id' => $target_id]);

        $action = match($body['status']) {
            'active'    => 'account_approved',
            'suspended' => 'account_suspended',
            default     => 'account_status_changed',
        };

        $this->audit->log(
            (int) $actor['user_id'],
            $action,
            'user',
            $target_id,
            ['new_status' => $body['status'], 'reason' => $body['reason'] ?? null]
        );

        // Send notification to the user
        $this->notify($target_id, 'Account Update', $this->statusMessage($body['status']));

        Response::success(null, 'Account status updated to ' . $body['status'] . '.');
    }

    /**
     * GET /users/{id}
     * Get a user's profile. Users can view their own; coordinator can view any.
     */
    public function getProfile(int $user_id): void {
        $actor = Auth::requireAuth();

        $is_self        = (int)$actor['user_id'] === $user_id;
        $is_coordinator = in_array('leap_coordinator', $actor['roles'], true);

        if (!$is_self && !$is_coordinator) {
            Response::forbidden();
        }

        $stmt = $this->db->prepare(
            'SELECT u.user_id, u.full_name, u.email, u.status, u.created_at,
                    sp.student_number, sp.programme, sp.semester,
                    sp.phone, sp.eligibility,
                    GROUP_CONCAT(r.role_name) AS roles
             FROM   users u
             LEFT JOIN student_profiles sp ON sp.user_id = u.user_id
             LEFT JOIN user_roles ur        ON ur.user_id = u.user_id
             LEFT JOIN roles r              ON r.role_id  = ur.role_id
             WHERE  u.user_id = :id
             GROUP  BY u.user_id'
        );
        $stmt->execute([':id' => $user_id]);
        $user = $stmt->fetch();

        if (!$user) {
            Response::notFound('User not found.');
        }

        $user['roles'] = $user['roles'] ? explode(',', $user['roles']) : [];

        Response::success($user);
    }

    /**
     * PUT /users/{id}
     * Update a user's own profile.
     */
    public function updateProfile(int $user_id): void {
        $actor = Auth::requireAuth();

        if ((int)$actor['user_id'] !== $user_id) {
            Response::forbidden('You can only update your own profile.');
        }

        $body = $this->getJsonBody();

        $v = new Validator();
        if (!empty($body['full_name'])) {
            $v->maxLength($body['full_name'], 'full_name', 150);
        }

        if (!$v->passes()) {
            Response::error('Validation failed.', 422, $v->errors());
        }

        // Update users table
        if (!empty($body['full_name'])) {
            $this->db->prepare(
                'UPDATE users SET full_name = :name, updated_at = NOW() WHERE user_id = :id'
            )->execute([':name' => trim($body['full_name']), ':id' => $user_id]);
        }

        // Update student profile if applicable
        $roles = Auth::getUserRoles($user_id);
        if (in_array('student', $roles, true)) {
            $fields = ['phone', 'programme'];
            foreach ($fields as $f) {
                if (isset($body[$f])) {
                    $this->db->prepare(
                        "INSERT INTO student_profiles (user_id, {$f}, student_number)
                         VALUES (:uid, :val, '')
                         ON DUPLICATE KEY UPDATE {$f} = :val2"
                    )->execute([':uid' => $user_id, ':val' => $body[$f], ':val2' => $body[$f]]);
                }
            }
        }

        $this->audit->log($user_id, 'profile_updated', 'user', $user_id);

        Response::success(null, 'Profile updated successfully.');
    }

    /**
     * PATCH /users/{id}/eligibility
     * Mark a student's eligibility status.
     * Roles: leap_coordinator, faculty_coordinator
     */
    public function updateEligibility(int $student_id): void {
        $actor = Auth::requireRole(['leap_coordinator', 'faculty_coordinator']);

        $body = $this->getJsonBody();

        $v = new Validator();
        $v->required($body['eligibility'] ?? null, 'eligibility')
          ->inList($body['eligibility'] ?? null, 'eligibility', ['eligible', 'ineligible', 'not_verified']);

        if (!$v->passes()) {
            Response::error('Validation failed.', 422, $v->errors());
        }

        $stmt = $this->db->prepare(
            'SELECT profile_id FROM student_profiles WHERE user_id = :id'
        );
        $stmt->execute([':id' => $student_id]);

        if (!$stmt->fetch()) {
            Response::notFound('Student profile not found.');
        }

        $this->db->prepare(
            'UPDATE student_profiles
             SET    eligibility = :elig,
                    verified_by = :verifier,
                    verified_at = NOW()
             WHERE  user_id = :id'
        )->execute([
            ':elig'     => $body['eligibility'],
            ':verifier' => $actor['user_id'],
            ':id'       => $student_id,
        ]);

        $this->audit->log(
            (int) $actor['user_id'],
            'eligibility_updated',
            'student_profile',
            $student_id,
            ['eligibility' => $body['eligibility']]
        );

        Response::success(null, 'Student eligibility updated.');
    }

    // -------------------------------------------------------------------------
    private function notify(int $user_id, string $title, string $message): void {
        try {
            $this->db->prepare(
                'INSERT INTO notifications (recipient_id, title, message, type, created_at)
                 VALUES (:uid, :title, :msg, \'account_update\', NOW())'
            )->execute([':uid' => $user_id, ':title' => $title, ':msg' => $message]);
        } catch (PDOException $e) {
            error_log('UserController::notify failed: ' . $e->getMessage());
        }
    }

    private function statusMessage(string $status): string {
        return match($status) {
            'active'    => 'Your account has been approved. You may now log in.',
            'suspended' => 'Your account has been suspended. Contact the coordinator.',
            default     => 'Your account status has been updated.',
        };
    }

    private function getJsonBody(): array {
        return json_decode(file_get_contents('php://input'), true) ?? [];
    }
}

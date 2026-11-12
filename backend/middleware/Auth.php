<?php
/**
 * Authentication Middleware
 * Digital LEAP Internship Management System
 *
 * Validates Bearer tokens on protected routes.
 * Tokens are stored in the database (no JWT dependency required).
 * Role-based access control enforced per endpoint.
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../utils/AuditLog.php';

class Auth {

    private static ?PDO $db = null;

    private static function getDb(): PDO {
        if (self::$db === null) {
            $database  = new Database();
            self::$db  = $database->getConnection();
        }
        return self::$db;
    }

    /**
     * Require a valid authenticated session.
     * Returns the authenticated user record if valid.
     * Terminates with 401 if not authenticated.
     *
     * @return array The authenticated user row.
     */
    public static function requireAuth(): array {
        $token = self::extractBearerToken();

        if ($token === null) {
            Response::unauthorized('No authentication token provided.');
        }

        $db   = self::getDb();
        $stmt = $db->prepare(
            'SELECT s.user_id, s.expires_at,
                    u.full_name, u.email, u.status
             FROM   user_sessions s
             JOIN   users u ON u.user_id = s.user_id
             WHERE  s.token = :token
               AND  s.expires_at > NOW()'
        );
        $stmt->execute([':token' => $token]);
        $session = $stmt->fetch();

        if (!$session) {
            Response::unauthorized('Session expired or invalid. Please log in again.');
        }

        if ($session['status'] !== 'active') {
            Response::unauthorized('Your account is not active. Contact the coordinator.');
        }

        // Attach roles to the user record
        $session['roles'] = self::getUserRoles((int)$session['user_id']);

        return $session;
    }

    /**
     * Require that the authenticated user holds at least one of the specified roles.
     * Terminates with 403 if the role requirement is not met.
     *
     * @param array $allowed_roles Array of role_name strings that are permitted.
     * @return array The authenticated user record.
     */
    public static function requireRole(array $allowed_roles): array {
        $user = self::requireAuth();

        $user_roles = $user['roles'] ?? [];
        foreach ($allowed_roles as $role) {
            if (in_array($role, $user_roles, true)) {
                return $user;
            }
        }

        Response::forbidden(
            'You do not have the required role to perform this action.'
        );
    }

    /**
     * Return the roles assigned to a user.
     *
     * @param int $user_id
     * @return array List of role_name strings.
     */
    public static function getUserRoles(int $user_id): array {
        $db   = self::getDb();
        $stmt = $db->prepare(
            'SELECT r.role_name
             FROM   user_roles ur
             JOIN   roles r ON r.role_id = ur.role_id
             WHERE  ur.user_id = :user_id'
        );
        $stmt->execute([':user_id' => $user_id]);
        return $stmt->fetchAll(PDO::FETCH_COLUMN);
    }

    /**
     * Extract the Bearer token from the Authorization header.
     */
    private static function extractBearerToken(): ?string {
        $header = $_SERVER['HTTP_AUTHORIZATION']
            ?? apache_request_headers()['Authorization']
            ?? null;

        if ($header && preg_match('/^Bearer\s+(.+)$/i', $header, $matches)) {
            return $matches[1];
        }

        return null;
    }

    /**
     * Generate a cryptographically secure session token.
     */
    public static function generateToken(): string {
        return bin2hex(random_bytes(32));
    }
}

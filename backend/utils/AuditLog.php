<?php
/**
 * Audit Log Utility
 * Digital LEAP Internship Management System
 *
 * Records important administrative actions with user, time, entity and details.
 * Required by NFR-06: All grade and approval changes logged with user and time.
 * Also records login events, account locks, and unlock events (D-05).
 */

class AuditLog {

    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    /**
     * Write an audit log entry.
     *
     * @param int|null    $user_id     The user performing the action (null for unauthenticated events).
     * @param string      $action      A short action code, e.g. 'login_failed', 'grade_approved'.
     * @param string|null $entity_type The type of record affected, e.g. 'placement', 'logbook_entry'.
     * @param int|null    $entity_id   The primary key of the affected record.
     * @param array       $details     Any additional structured details (stored as JSON).
     */
    public function log(
        ?int    $user_id,
        string  $action,
        ?string $entity_type = null,
        ?int    $entity_id   = null,
        array   $details     = []
    ): void {
        try {
            $ip = $this->getClientIp();

            $stmt = $this->db->prepare(
                'INSERT INTO audit_logs
                    (user_id, action, entity_type, entity_id, details, ip_address, created_at)
                 VALUES
                    (:user_id, :action, :entity_type, :entity_id, :details, :ip_address, NOW())'
            );

            $stmt->execute([
                ':user_id'     => $user_id,
                ':action'      => $action,
                ':entity_type' => $entity_type,
                ':entity_id'   => $entity_id,
                ':details'     => !empty($details) ? json_encode($details, JSON_UNESCAPED_UNICODE) : null,
                ':ip_address'  => $ip,
            ]);
        } catch (PDOException $e) {
            // Audit log failure must never crash the main request
            error_log('AuditLog::log failed: ' . $e->getMessage());
        }
    }

    /**
     * Get the real client IP address safely.
     * Handles common proxy headers without trusting them blindly.
     */
    private function getClientIp(): string {
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

        // Accept forwarded IP only if it looks like a valid IP
        if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $forwarded = trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0]);
            if (filter_var($forwarded, FILTER_VALIDATE_IP)) {
                $ip = $forwarded;
            }
        }

        return $ip;
    }
}

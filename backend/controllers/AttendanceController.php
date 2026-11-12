<?php
/**
 * GPS Attendance Controller
 * Digital LEAP Internship Management System
 *
 * Additional lecturer requirement (D-04).
 * Records GPS coordinates for student attendance verification at host sites.
 *
 * Privacy rules enforced:
 * - consent_given MUST be TRUE (explicitly provided by student) before any
 *   coordinates are stored. The database CHECK constraint also enforces this.
 * - Students can only record their own attendance.
 * - Location data is restricted by role — host supervisors and coordinators
 *   can verify; management sees summary counts only.
 * - Accuracy in metres is stored to allow quality filtering.
 * - All attendance recording events are written to audit_logs.
 *
 * NOTE: GPS-based attendance does not automatically prove physical presence.
 * Coordinates are one input into a human verification decision (verified_status).
 * This distinction must be documented in the technical report (D-04).
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../utils/Validator.php';
require_once __DIR__ . '/../utils/AuditLog.php';
require_once __DIR__ . '/../middleware/Auth.php';

class AttendanceController {

    private PDO      $db;
    private AuditLog $audit;

    public function __construct(PDO $db) {
        $this->db    = $db;
        $this->audit = new AuditLog($db);
    }

    /**
     * POST /attendance
     * Student records GPS attendance with explicit consent (D-04).
     *
     * Required body:
     *   placement_id  int
     *   latitude      float  (-90 to 90)
     *   longitude     float  (-180 to 180)
     *   consent_given bool   MUST be true — no record created without consent
     *   accuracy_meters float (optional — GPS accuracy in metres)
     */
    public function record(): void {
        $actor = Auth::requireRole(['student']);
        $body  = $this->getJsonBody();
        $uid   = (int) $actor['user_id'];

        $v = new Validator();
        $v->required($body['placement_id']  ?? null, 'placement_id')
          ->required($body['latitude']       ?? null, 'latitude')
          ->latitude($body['latitude']       ?? null, 'latitude')
          ->required($body['longitude']      ?? null, 'longitude')
          ->longitude($body['longitude']     ?? null, 'longitude');

        if (!$v->passes()) {
            Response::error('Validation failed.', 422, $v->errors());
        }

        // Consent is mandatory — explicit boolean true from the client
        $consent = $body['consent_given'] ?? false;
        if ($consent !== true && $consent !== 1 && $consent !== '1') {
            Response::error(
                'Location data cannot be recorded without your explicit consent. ' .
                'Please confirm consent before recording attendance.',
                403
            );
        }

        // Confirm placement belongs to this student and is active
        $pl = $this->db->prepare(
            'SELECT placement_id, student_id, status
             FROM   placements
             WHERE  placement_id = :pid AND student_id = :uid'
        );
        $pl->execute([':pid' => $body['placement_id'], ':uid' => $uid]);
        $placement = $pl->fetch();

        if (!$placement) {
            Response::notFound('Placement not found or does not belong to you.');
        }

        if (!in_array($placement['status'], ['confirmed', 'active'], true)) {
            Response::error('Attendance can only be recorded for confirmed or active placements.', 403);
        }

        // Prevent duplicate recording within the same hour (basic spam guard)
        $recent = $this->db->prepare(
            'SELECT attendance_id FROM gps_attendance_records
             WHERE  student_id    = :uid
               AND  placement_id  = :pid
               AND  recorded_at  >= DATE_SUB(NOW(), INTERVAL 1 HOUR)'
        );
        $recent->execute([':uid' => $uid, ':pid' => $body['placement_id']]);
        if ($recent->fetch()) {
            Response::error('An attendance record was already submitted within the last hour.', 429);
        }

        $this->db->prepare(
            'INSERT INTO gps_attendance_records
                (placement_id, student_id, recorded_at, latitude, longitude,
                 accuracy_meters, consent_given, verified_status)
             VALUES
                (:pid, :uid, NOW(), :lat, :lon, :acc, 1, \'pending\')'
        )->execute([
            ':pid' => (int) $body['placement_id'],
            ':uid' => $uid,
            ':lat' => (float) $body['latitude'],
            ':lon' => (float) $body['longitude'],
            ':acc' => isset($body['accuracy_meters']) ? (float)$body['accuracy_meters'] : null,
        ]);

        $attendance_id = (int) $this->db->lastInsertId();

        $this->audit->log($uid, 'attendance_recorded', 'gps_attendance', $attendance_id, [
            'placement_id' => (int) $body['placement_id'],
            'consent'      => true,
            // Coordinates deliberately omitted from audit log details to limit
            // exposure of precise location data in the audit table.
        ]);

        // Notify host supervisor that a check-in has been recorded
        $sup_stmt = $this->db->prepare(
            'SELECT host_supervisor_id FROM placements WHERE placement_id = :pid'
        );
        $sup_stmt->execute([':pid' => $body['placement_id']]);
        $p = $sup_stmt->fetch();
        if ($p && $p['host_supervisor_id']) {
            $this->notify(
                (int) $p['host_supervisor_id'],
                'Intern Check-In',
                'An intern has recorded GPS attendance at your location. Please verify.'
            );
        }

        Response::success(
            ['attendance_id' => $attendance_id],
            'Attendance recorded. Awaiting verification.',
            201
        );
    }

    /**
     * GET /attendance/{placement_id}
     * List attendance records for a placement.
     * Student sees own records; coordinator and host supervisor see all for the placement.
     */
    public function list(int $placement_id): void {
        $actor = Auth::requireAuth();
        $uid   = (int) $actor['user_id'];
        $roles = $actor['roles'];

        // Confirm access
        $pl = $this->db->prepare(
            'SELECT student_id, host_supervisor_id FROM placements WHERE placement_id = :id'
        );
        $pl->execute([':id' => $placement_id]);
        $placement = $pl->fetch();

        if (!$placement) Response::notFound('Placement not found.');

        $can_view =
            in_array('leap_coordinator', $roles, true) ||
            (int)$placement['student_id']         === $uid ||
            (int)$placement['host_supervisor_id'] === $uid ||
            in_array('academic_supervisor', $roles, true) ||
            in_array('faculty_coordinator', $roles, true);

        if (!$can_view) Response::forbidden();

        $is_student = in_array('student', $roles, true) && !in_array('leap_coordinator', $roles, true);

        // Students see their own records but with coordinates masked to 2 dp
        // (reduces precision of stored location shown back to student).
        if ($is_student) {
            $stmt = $this->db->prepare(
                'SELECT attendance_id, placement_id,
                        ROUND(latitude, 2)  AS latitude,
                        ROUND(longitude, 2) AS longitude,
                        accuracy_meters, verified_status, notes, recorded_at
                 FROM   gps_attendance_records
                 WHERE  placement_id = :pid AND student_id = :uid
                 ORDER  BY recorded_at DESC'
            );
            $stmt->execute([':pid' => $placement_id, ':uid' => $uid]);
        } else {
            // Supervisors and coordinators see full coordinates
            $stmt = $this->db->prepare(
                'SELECT g.attendance_id, g.placement_id,
                        g.latitude, g.longitude, g.accuracy_meters,
                        g.verified_status, g.notes, g.recorded_at,
                        u.full_name AS student_name,
                        u_v.full_name AS verified_by_name
                 FROM   gps_attendance_records g
                 JOIN   users u    ON u.user_id   = g.student_id
                 LEFT JOIN users u_v ON u_v.user_id = g.verified_by
                 WHERE  g.placement_id = :pid
                 ORDER  BY g.recorded_at DESC'
            );
            $stmt->execute([':pid' => $placement_id]);
        }

        Response::success($stmt->fetchAll());
    }

    /**
     * PATCH /attendance/{id}/verify
     * Coordinator or host supervisor verifies or rejects an attendance record (D-04).
     */
    public function verify(int $attendance_id): void {
        $actor = Auth::requireRole(['leap_coordinator', 'host_supervisor', 'academic_supervisor']);
        $body  = $this->getJsonBody();
        $uid   = (int) $actor['user_id'];

        $v = new Validator();
        $v->required($body['status'] ?? null, 'status')
          ->inList($body['status']   ?? null, 'status', ['verified', 'rejected']);

        if (!$v->passes()) Response::error('Validation failed.', 422, $v->errors());

        $stmt = $this->db->prepare(
            'SELECT attendance_id, student_id, verified_status
             FROM   gps_attendance_records WHERE attendance_id = :id'
        );
        $stmt->execute([':id' => $attendance_id]);
        $record = $stmt->fetch();

        if (!$record) Response::notFound('Attendance record not found.');

        $this->db->prepare(
            'UPDATE gps_attendance_records
             SET    verified_status = :status,
                    verified_by     = :uid,
                    notes           = :notes
             WHERE  attendance_id   = :id'
        )->execute([
            ':status' => $body['status'],
            ':uid'    => $uid,
            ':notes'  => $body['notes'] ?? null,
            ':id'     => $attendance_id,
        ]);

        $this->audit->log($uid, 'attendance_verified', 'gps_attendance', $attendance_id, [
            'status' => $body['status'],
        ]);

        // Notify the student
        $msg = $body['status'] === 'verified'
            ? 'Your attendance record has been verified.'
            : 'Your attendance record was not verified. Contact your supervisor.';

        $this->notify((int) $record['student_id'], 'Attendance Update', $msg);

        Response::success(null, "Attendance record {$body['status']}.");
    }

    // -------------------------------------------------------------------------
    private function notify(int $user_id, string $title, string $message): void {
        try {
            $this->db->prepare(
                'INSERT INTO notifications (recipient_id, title, message, type, created_at)
                 VALUES (:uid, :title, :msg, \'attendance_update\', NOW())'
            )->execute([':uid' => $user_id, ':title' => $title, ':msg' => $message]);
        } catch (PDOException $e) {
            error_log('AttendanceController::notify: ' . $e->getMessage());
        }
    }

    private function getJsonBody(): array {
        return json_decode(file_get_contents('php://input'), true) ?? [];
    }
}

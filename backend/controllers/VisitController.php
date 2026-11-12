<?php
/**
 * Visit Controller
 * Digital LEAP Internship Management System
 *
 * FR-09: Supervisors schedule visits and record visit reports.
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../utils/Validator.php';
require_once __DIR__ . '/../utils/AuditLog.php';
require_once __DIR__ . '/../middleware/Auth.php';

class VisitController {

    private PDO      $db;
    private AuditLog $audit;

    public function __construct(PDO $db) {
        $this->db    = $db;
        $this->audit = new AuditLog($db);
    }

    /**
     * GET /visits
     * List visits relevant to the authenticated user.
     */
    public function list(): void {
        $actor = Auth::requireAuth();
        $uid   = (int) $actor['user_id'];
        $roles = $actor['roles'];

        if (in_array('leap_coordinator', $roles, true) || in_array('management', $roles, true)) {
            $stmt = $this->db->prepare(
                'SELECT sv.*, u_sup.full_name AS supervisor_name,
                        u_s.full_name AS student_name, ho.org_name
                 FROM   supervisory_visits sv
                 JOIN   placements p     ON p.placement_id  = sv.placement_id
                 JOIN   users u_sup      ON u_sup.user_id   = sv.supervisor_id
                 JOIN   users u_s        ON u_s.user_id     = p.student_id
                 JOIN   host_organisations ho ON ho.org_id  = p.org_id
                 ORDER  BY sv.scheduled_date DESC'
            );
            $stmt->execute();
        } elseif (
            in_array('academic_supervisor', $roles, true) ||
            in_array('faculty_coordinator', $roles, true) ||
            in_array('faculty_mentor',      $roles, true)
        ) {
            $stmt = $this->db->prepare(
                'SELECT sv.*, u_s.full_name AS student_name, ho.org_name
                 FROM   supervisory_visits sv
                 JOIN   placements p ON p.placement_id = sv.placement_id
                 JOIN   users u_s   ON u_s.user_id     = p.student_id
                 JOIN   host_organisations ho ON ho.org_id = p.org_id
                 WHERE  sv.supervisor_id = :uid
                 ORDER  BY sv.scheduled_date DESC'
            );
            $stmt->execute([':uid' => $uid]);
        } else {
            // Student sees visits for their placement
            $stmt = $this->db->prepare(
                'SELECT sv.*, u_sup.full_name AS supervisor_name, ho.org_name
                 FROM   supervisory_visits sv
                 JOIN   placements p    ON p.placement_id = sv.placement_id
                 JOIN   users u_sup     ON u_sup.user_id  = sv.supervisor_id
                 JOIN   host_organisations ho ON ho.org_id = p.org_id
                 WHERE  p.student_id = :uid
                 ORDER  BY sv.scheduled_date DESC'
            );
            $stmt->execute([':uid' => $uid]);
        }

        Response::success($stmt->fetchAll());
    }

    /**
     * POST /visits
     * Schedule a supervisory visit (FR-09).
     * Roles: academic_supervisor, faculty_coordinator, faculty_mentor, leap_coordinator
     */
    public function schedule(): void {
        $actor = Auth::requireRole([
            'academic_supervisor', 'faculty_coordinator', 'faculty_mentor', 'leap_coordinator'
        ]);
        $body = $this->getJsonBody();
        $uid  = (int) $actor['user_id'];

        $v = new Validator();
        $v->required($body['placement_id']    ?? null, 'placement_id')
          ->required($body['scheduled_date']  ?? null, 'scheduled_date')
          ->date($body['scheduled_date']       ?? null, 'scheduled_date');

        if (!$v->passes()) {
            Response::error('Validation failed.', 422, $v->errors());
        }

        // Confirm placement is active/confirmed
        $pl = $this->db->prepare(
            'SELECT placement_id, student_id, status
             FROM   placements WHERE placement_id = :pid'
        );
        $pl->execute([':pid' => $body['placement_id']]);
        $placement = $pl->fetch();

        if (!$placement) {
            Response::notFound('Placement not found.');
        }

        if (!in_array($placement['status'], ['confirmed', 'active'], true)) {
            Response::error('Visits can only be scheduled for confirmed or active placements.', 403);
        }

        $this->db->prepare(
            'INSERT INTO supervisory_visits
                (placement_id, supervisor_id, scheduled_date, scheduled_time,
                 location, status, created_at)
             VALUES (:pid, :uid, :date, :time, :location, \'scheduled\', NOW())'
        )->execute([
            ':pid'      => (int) $body['placement_id'],
            ':uid'      => $uid,
            ':date'     => $body['scheduled_date'],
            ':time'     => $body['scheduled_time'] ?? null,
            ':location' => $body['location']       ?? null,
        ]);

        $visit_id = (int) $this->db->lastInsertId();

        // Notify student
        $this->notify(
            (int) $placement['student_id'],
            'Visit Scheduled',
            "A supervisory visit has been scheduled for {$body['scheduled_date']}."
        );

        $this->audit->log($uid, 'visit_scheduled', 'supervisory_visit', $visit_id,
            ['placement_id' => (int)$body['placement_id']]
        );

        Response::success(['visit_id' => $visit_id], 'Visit scheduled.', 201);
    }

    /**
     * POST /visits/{id}/report
     * Supervisor records a visit report after completing the visit (FR-09).
     */
    public function submitReport(int $visit_id): void {
        $actor = Auth::requireRole([
            'academic_supervisor', 'faculty_coordinator', 'faculty_mentor', 'leap_coordinator'
        ]);
        $body = $this->getJsonBody();
        $uid  = (int) $actor['user_id'];

        $v = new Validator();
        $v->required($body['observations'] ?? null, 'observations');

        if (!$v->passes()) {
            Response::error('Validation failed.', 422, $v->errors());
        }

        // Confirm visit exists and belongs to this supervisor
        $stmt = $this->db->prepare(
            'SELECT visit_id, supervisor_id, placement_id, status
             FROM   supervisory_visits WHERE visit_id = :id'
        );
        $stmt->execute([':id' => $visit_id]);
        $visit = $stmt->fetch();

        if (!$visit) {
            Response::notFound('Visit not found.');
        }

        if ((int)$visit['supervisor_id'] !== $uid && !in_array('leap_coordinator', $actor['roles'], true)) {
            Response::forbidden('You are not assigned to this visit.');
        }

        // Check no report already exists
        $existing = $this->db->prepare(
            'SELECT report_id FROM visit_reports WHERE visit_id = :id'
        );
        $existing->execute([':id' => $visit_id]);
        if ($existing->fetch()) {
            Response::error('A report for this visit already exists.', 409);
        }

        $this->db->beginTransaction();
        try {
            $this->db->prepare(
                'INSERT INTO visit_reports
                    (visit_id, supervisor_id, observations,
                     recommendations, student_performance, submitted_at)
                 VALUES (:vid, :uid, :obs, :rec, :perf, NOW())'
            )->execute([
                ':vid'  => $visit_id,
                ':uid'  => $uid,
                ':obs'  => trim($body['observations']),
                ':rec'  => $body['recommendations']    ?? null,
                ':perf' => $body['student_performance'] ?? null,
            ]);

            // Mark visit as completed
            $this->db->prepare(
                'UPDATE supervisory_visits SET status = \'completed\' WHERE visit_id = :id'
            )->execute([':id' => $visit_id]);

            $this->db->commit();
        } catch (Exception $e) {
            $this->db->rollBack();
            error_log('VisitController::submitReport: ' . $e->getMessage());
            Response::serverError();
        }

        // Notify coordinator
        $this->notifyCoordinator(
            'Visit Report Submitted',
            "A visit report has been submitted for placement ID {$visit['placement_id']}."
        );

        $this->audit->log($uid, 'visit_report_submitted', 'supervisory_visit', $visit_id);

        Response::success(null, 'Visit report submitted.', 201);
    }

    // -------------------------------------------------------------------------
    private function notify(int $user_id, string $title, string $message): void {
        try {
            $this->db->prepare(
                'INSERT INTO notifications (recipient_id, title, message, type, created_at)
                 VALUES (:uid, :title, :msg, \'visit_update\', NOW())'
            )->execute([':uid' => $user_id, ':title' => $title, ':msg' => $message]);
        } catch (PDOException $e) {
            error_log('VisitController::notify: ' . $e->getMessage());
        }
    }

    private function notifyCoordinator(string $title, string $message): void {
        try {
            $stmt = $this->db->prepare(
                'SELECT u.user_id FROM users u
                 JOIN   user_roles ur ON ur.user_id = u.user_id
                 JOIN   roles r       ON r.role_id  = ur.role_id
                 WHERE  r.role_name = \'leap_coordinator\' AND u.status = \'active\'
                 LIMIT  1'
            );
            $stmt->execute();
            $coord = $stmt->fetch();
            if ($coord) {
                $this->notify((int)$coord['user_id'], $title, $message);
            }
        } catch (PDOException $e) {
            error_log('VisitController::notifyCoordinator: ' . $e->getMessage());
        }
    }

    private function getJsonBody(): array {
        return json_decode(file_get_contents('php://input'), true) ?? [];
    }
}

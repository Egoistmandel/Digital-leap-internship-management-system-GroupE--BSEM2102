<?php
/**
 * Logbook Controller
 * Digital LEAP Internship Management System
 *
 * FR-07: Students submit validated weekly logbook entries.
 * FR-08: Supervisors approve entries or request revisions.
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../utils/Validator.php';
require_once __DIR__ . '/../utils/AuditLog.php';
require_once __DIR__ . '/../middleware/Auth.php';

class LogbookController {

    private PDO      $db;
    private AuditLog $audit;

    public function __construct(PDO $db) {
        $this->db    = $db;
        $this->audit = new AuditLog($db);
    }

    /**
     * GET /placements/{id}/logbook
     * List all logbook entries for a placement.
     */
    public function listEntries(int $placement_id): void {
        $actor = Auth::requireAuth();

        $this->assertPlacementAccess($placement_id, $actor);

        $stmt = $this->db->prepare(
            'SELECT le.entry_id, le.week_number, le.entry_date,
                    le.activities, le.skills_gained, le.hours_worked,
                    le.status, le.submitted_at, le.created_at,
                    (SELECT lr.decision FROM logbook_reviews lr
                     WHERE  lr.entry_id = le.entry_id
                     ORDER  BY lr.reviewed_at DESC LIMIT 1) AS last_decision,
                    (SELECT lr.comments FROM logbook_reviews lr
                     WHERE  lr.entry_id = le.entry_id
                     ORDER  BY lr.reviewed_at DESC LIMIT 1) AS last_comment
             FROM   logbook_entries le
             WHERE  le.placement_id = :pid
             ORDER  BY le.week_number ASC'
        );
        $stmt->execute([':pid' => $placement_id]);

        Response::success($stmt->fetchAll());
    }

    /**
     * POST /placements/{id}/logbook
     * Student submits a new logbook entry (FR-07).
     * Validates: required fields, date within placement period, one entry per week.
     */
    public function submitEntry(int $placement_id): void {
        $actor = Auth::requireRole(['student']);
        $body  = $this->getJsonBody();
        $uid   = (int) $actor['user_id'];

        // Confirm placement belongs to this student and is active/confirmed
        $pl = $this->db->prepare(
            'SELECT placement_id, student_id, start_date, end_date, status
             FROM   placements
             WHERE  placement_id = :pid AND student_id = :uid'
        );
        $pl->execute([':pid' => $placement_id, ':uid' => $uid]);
        $placement = $pl->fetch();

        if (!$placement) {
            Response::notFound('Placement not found or does not belong to you.');
        }

        if (!in_array($placement['status'], ['confirmed', 'active'], true)) {
            Response::error('Logbook entries can only be submitted for confirmed or active placements.', 403);
        }

        // Validate fields
        $v = new Validator();
        $v->required($body['week_number']  ?? null, 'week_number')
          ->numeric($body['week_number']   ?? null, 'week_number', 1, 52)
          ->required($body['entry_date']   ?? null, 'entry_date')
          ->date($body['entry_date']       ?? null, 'entry_date')
          ->required($body['activities']   ?? null, 'activities')
          ->required($body['hours_worked'] ?? null, 'hours_worked')
          ->numeric($body['hours_worked']  ?? null, 'hours_worked', 0.5, 168);

        if (!$v->passes()) {
            Response::error('Validation failed.', 422, $v->errors());
        }

        // Validate entry_date falls within placement period
        if ($placement['start_date'] && $placement['end_date']) {
            $entry = new DateTime($body['entry_date']);
            $start = new DateTime($placement['start_date']);
            $end   = new DateTime($placement['end_date']);

            if ($entry < $start || $entry > $end) {
                Response::error(
                    "Entry date must be between {$placement['start_date']} and {$placement['end_date']}.",
                    422
                );
            }
        }

        // Check for duplicate week entry
        $dup = $this->db->prepare(
            'SELECT entry_id FROM logbook_entries
             WHERE  placement_id = :pid AND week_number = :week'
        );
        $dup->execute([':pid' => $placement_id, ':week' => (int)$body['week_number']]);

        if ($dup->fetch()) {
            Response::error('An entry for week ' . (int)$body['week_number'] . ' already exists.', 409);
        }

        $this->db->prepare(
            'INSERT INTO logbook_entries
                (placement_id, student_id, week_number, entry_date,
                 activities, skills_gained, hours_worked,
                 status, submitted_at, created_at, updated_at)
             VALUES
                (:pid, :uid, :week, :date,
                 :activities, :skills, :hours,
                 \'submitted\', NOW(), NOW(), NOW())'
        )->execute([
            ':pid'        => $placement_id,
            ':uid'        => $uid,
            ':week'       => (int) $body['week_number'],
            ':date'       => $body['entry_date'],
            ':activities' => trim($body['activities']),
            ':skills'     => $body['skills_gained']  ?? null,
            ':hours'      => (float) $body['hours_worked'],
        ]);

        $entry_id = (int) $this->db->lastInsertId();

        // Notify assigned supervisor
        $sup = $this->db->prepare(
            'SELECT academic_supervisor_id FROM placements WHERE placement_id = :pid'
        );
        $sup->execute([':pid' => $placement_id]);
        $p = $sup->fetch();
        if ($p && $p['academic_supervisor_id']) {
            $this->notify(
                (int) $p['academic_supervisor_id'],
                'New Logbook Entry',
                'A student has submitted a logbook entry for Week ' . (int)$body['week_number'] . '. Please review.'
            );
        }

        $this->audit->log($uid, 'logbook_submitted', 'logbook_entry', $entry_id,
            ['placement_id' => $placement_id, 'week' => (int)$body['week_number']]
        );

        Response::success(['entry_id' => $entry_id], 'Logbook entry submitted.', 201);
    }

    /**
     * GET /logbook/{entry_id}
     * Get a single logbook entry with its review history.
     */
    public function getEntry(int $entry_id): void {
        $actor = Auth::requireAuth();

        $stmt = $this->db->prepare(
            'SELECT le.*, p.student_id, p.academic_supervisor_id
             FROM   logbook_entries le
             JOIN   placements p ON p.placement_id = le.placement_id
             WHERE  le.entry_id = :id'
        );
        $stmt->execute([':id' => $entry_id]);
        $entry = $stmt->fetch();

        if (!$entry) {
            Response::notFound('Logbook entry not found.');
        }

        $uid   = (int) $actor['user_id'];
        $roles = $actor['roles'];

        $can_view =
            in_array('leap_coordinator', $roles, true) ||
            (int)$entry['student_id']             === $uid ||
            (int)$entry['academic_supervisor_id'] === $uid ||
            in_array('faculty_coordinator', $roles, true) ||
            in_array('faculty_mentor',      $roles, true);

        if (!$can_view) {
            Response::forbidden();
        }

        // Attach review history
        $rev = $this->db->prepare(
            'SELECT lr.review_id, lr.decision, lr.comments, lr.reviewed_at,
                    u.full_name AS reviewer_name
             FROM   logbook_reviews lr
             JOIN   users u ON u.user_id = lr.reviewer_id
             WHERE  lr.entry_id = :id
             ORDER  BY lr.reviewed_at ASC'
        );
        $rev->execute([':id' => $entry_id]);
        $entry['reviews'] = $rev->fetchAll();

        Response::success($entry);
    }

    /**
     * PATCH /logbook/{entry_id}/review
     * Supervisor approves or requests revision (FR-08).
     */
    public function reviewEntry(int $entry_id): void {
        $actor = Auth::requireRole([
            'academic_supervisor', 'faculty_coordinator', 'faculty_mentor', 'leap_coordinator'
        ]);
        $body = $this->getJsonBody();
        $uid  = (int) $actor['user_id'];

        $v = new Validator();
        $v->required($body['decision'] ?? null, 'decision')
          ->inList($body['decision']   ?? null, 'decision', ['approved', 'revision_requested']);

        if (!$v->passes()) {
            Response::error('Validation failed.', 422, $v->errors());
        }

        if ($body['decision'] === 'revision_requested' && empty($body['comments'])) {
            Response::error('Comments are required when requesting a revision.', 422);
        }

        // Fetch entry
        $stmt = $this->db->prepare(
            'SELECT le.entry_id, le.status, le.placement_id, p.student_id
             FROM   logbook_entries le
             JOIN   placements p ON p.placement_id = le.placement_id
             WHERE  le.entry_id = :id'
        );
        $stmt->execute([':id' => $entry_id]);
        $entry = $stmt->fetch();

        if (!$entry) {
            Response::notFound('Logbook entry not found.');
        }

        if ($entry['status'] === 'approved') {
            Response::error('This entry has already been approved.', 409);
        }

        $this->db->beginTransaction();
        try {
            // Insert review record
            $this->db->prepare(
                'INSERT INTO logbook_reviews
                    (entry_id, reviewer_id, decision, comments, reviewed_at)
                 VALUES (:eid, :uid, :decision, :comments, NOW())'
            )->execute([
                ':eid'      => $entry_id,
                ':uid'      => $uid,
                ':decision' => $body['decision'],
                ':comments' => $body['comments'] ?? null,
            ]);

            // Update entry status
            $new_status = $body['decision'] === 'approved' ? 'approved' : 'revision_requested';
            $this->db->prepare(
                'UPDATE logbook_entries SET status = :status, updated_at = NOW() WHERE entry_id = :id'
            )->execute([':status' => $new_status, ':id' => $entry_id]);

            $this->db->commit();
        } catch (Exception $e) {
            $this->db->rollBack();
            error_log('LogbookController::reviewEntry: ' . $e->getMessage());
            Response::serverError();
        }

        // Notify student
        $msg = $body['decision'] === 'approved'
            ? 'Your logbook entry has been approved.'
            : 'Your logbook entry requires revision. Comments: ' . ($body['comments'] ?? '');

        $this->notify((int) $entry['student_id'], 'Logbook Review', $msg);

        $this->audit->log($uid, 'logbook_reviewed', 'logbook_entry', $entry_id, [
            'decision' => $body['decision'],
        ]);

        Response::success(null, 'Review recorded.');
    }

    // -------------------------------------------------------------------------
    private function assertPlacementAccess(int $placement_id, array $actor): void {
        $uid   = (int) $actor['user_id'];
        $roles = $actor['roles'];

        if (in_array('leap_coordinator', $roles, true) || in_array('management', $roles, true)) {
            return; // Full access
        }

        $stmt = $this->db->prepare(
            'SELECT student_id, academic_supervisor_id
             FROM   placements WHERE placement_id = :id'
        );
        $stmt->execute([':id' => $placement_id]);
        $pl = $stmt->fetch();

        if (!$pl) Response::notFound('Placement not found.');

        $can_access =
            (int)$pl['student_id']             === $uid ||
            (int)$pl['academic_supervisor_id'] === $uid ||
            in_array('faculty_coordinator', $roles, true) ||
            in_array('faculty_mentor',      $roles, true);

        if (!$can_access) Response::forbidden();
    }

    private function notify(int $user_id, string $title, string $message): void {
        try {
            $this->db->prepare(
                'INSERT INTO notifications (recipient_id, title, message, type, created_at)
                 VALUES (:uid, :title, :msg, \'logbook_update\', NOW())'
            )->execute([':uid' => $user_id, ':title' => $title, ':msg' => $message]);
        } catch (PDOException $e) {
            error_log('LogbookController::notify: ' . $e->getMessage());
        }
    }

    private function getJsonBody(): array {
        return json_decode(file_get_contents('php://input'), true) ?? [];
    }
}

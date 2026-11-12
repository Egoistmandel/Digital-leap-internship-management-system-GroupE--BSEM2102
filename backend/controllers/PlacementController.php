<?php
/**
 * Placement Controller
 * Digital LEAP Internship Management System
 *
 * FR-03: Students submit placement applications online.
 * FR-04: Coordinator matches applications to host vacancies.
 * FR-05: System generates placement letters automatically.
 * FR-06: Hosts accept or decline placement requests online.
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../utils/Validator.php';
require_once __DIR__ . '/../utils/AuditLog.php';
require_once __DIR__ . '/../middleware/Auth.php';

class PlacementController {

    private PDO      $db;
    private AuditLog $audit;

    public function __construct(PDO $db) {
        $this->db    = $db;
        $this->audit = new AuditLog($db);
    }

    /**
     * GET /placements
     * List placements. Each role sees only relevant placements.
     */
    public function list(): void {
        $actor = Auth::requireAuth();
        $roles = $actor['roles'];
        $uid   = (int) $actor['user_id'];

        if (in_array('leap_coordinator', $roles, true) || in_array('management', $roles, true)) {
            // Coordinator and management see all
            $stmt = $this->db->prepare($this->placementQuery(''));
            $stmt->execute();
        } elseif (in_array('host_supervisor', $roles, true)) {
            // Host supervisor sees placements at their organisation
            $stmt = $this->db->prepare(
                $this->placementQuery('WHERE p.host_supervisor_id = :uid OR ho.contact_email = u_actor.email')
            );
            $stmt->execute([':uid' => $uid]);
        } elseif (
            in_array('academic_supervisor', $roles, true) ||
            in_array('faculty_coordinator', $roles, true) ||
            in_array('faculty_mentor',      $roles, true)
        ) {
            $stmt = $this->db->prepare(
                $this->placementQuery('WHERE p.academic_supervisor_id = :uid')
            );
            $stmt->execute([':uid' => $uid]);
        } else {
            // Student sees own placements only
            $stmt = $this->db->prepare(
                $this->placementQuery('WHERE p.student_id = :uid')
            );
            $stmt->execute([':uid' => $uid]);
        }

        Response::success($stmt->fetchAll());
    }

    /**
     * POST /placements
     * Student submits a placement application (FR-03).
     */
    public function apply(): void {
        $actor = Auth::requireRole(['student']);
        $body  = $this->getJsonBody();
        $uid   = (int) $actor['user_id'];

        $v = new Validator();
        $v->required($body['vacancy_id'] ?? null, 'vacancy_id');

        if (!$v->passes()) {
            Response::error('Validation failed.', 422, $v->errors());
        }

        // Check eligibility
        $elig = $this->db->prepare(
            'SELECT eligibility FROM student_profiles WHERE user_id = :uid'
        );
        $elig->execute([':uid' => $uid]);
        $profile = $elig->fetch();

        if (!$profile || $profile['eligibility'] !== 'eligible') {
            Response::error(
                'Your eligibility has not been verified. Contact the coordinator before applying.',
                403
            );
        }

        // Confirm vacancy exists and has capacity
        $vac = $this->db->prepare(
            'SELECT v.vacancy_id, v.org_id, v.capacity, v.filled_count,
                    v.start_date, v.end_date, v.is_active
             FROM   host_vacancies v
             JOIN   host_organisations ho ON ho.org_id = v.org_id
             WHERE  v.vacancy_id = :id AND v.is_active = 1 AND ho.status = \'approved\''
        );
        $vac->execute([':id' => $body['vacancy_id']]);
        $vacancy = $vac->fetch();

        if (!$vacancy) {
            Response::error('Vacancy not found or not available.', 404);
        }

        if ((int)$vacancy['filled_count'] >= (int)$vacancy['capacity']) {
            Response::error('This vacancy is fully booked.', 409);
        }

        // Check student does not already have an active/pending placement
        $existing = $this->db->prepare(
            'SELECT placement_id FROM placements
             WHERE  student_id = :uid
               AND  status NOT IN (\'rejected\', \'completed\')'
        );
        $existing->execute([':uid' => $uid]);
        if ($existing->fetch()) {
            Response::error('You already have an active or pending placement.', 409);
        }

        // Find coordinator (first active leap_coordinator)
        $coord = $this->db->prepare(
            'SELECT u.user_id FROM users u
             JOIN   user_roles ur ON ur.user_id = u.user_id
             JOIN   roles r       ON r.role_id  = ur.role_id
             WHERE  r.role_name = \'leap_coordinator\' AND u.status = \'active\'
             LIMIT  1'
        );
        $coord->execute();
        $coordinator = $coord->fetch();

        if (!$coordinator) {
            Response::error('No active coordinator found. Please contact the university.', 503);
        }

        $this->db->prepare(
            'INSERT INTO placements
                (student_id, vacancy_id, org_id, coordinator_id,
                 preferred_sector, status, start_date, end_date, created_at, updated_at)
             VALUES
                (:student, :vacancy, :org, :coord,
                 :sector, \'pending\', :start, :end, NOW(), NOW())'
        )->execute([
            ':student' => $uid,
            ':vacancy' => $body['vacancy_id'],
            ':org'     => $vacancy['org_id'],
            ':coord'   => $coordinator['user_id'],
            ':sector'  => $body['preferred_sector'] ?? null,
            ':start'   => $vacancy['start_date'],
            ':end'     => $vacancy['end_date'],
        ]);

        $placement_id = (int) $this->db->lastInsertId();

        $this->audit->log($uid, 'placement_applied', 'placement', $placement_id);
        $this->notify(
            (int) $coordinator['user_id'],
            'New Placement Application',
            'A student has submitted a placement application. Please review.'
        );

        Response::success(['placement_id' => $placement_id], 'Placement application submitted.', 201);
    }

    /**
     * GET /placements/{id}
     * Get a single placement with full details.
     */
    public function get(int $placement_id): void {
        $actor = Auth::requireAuth();

        $stmt = $this->db->prepare(
            'SELECT p.*,
                    u_s.full_name AS student_name, u_s.email AS student_email,
                    ho.org_name, ho.industry,
                    hv.title AS vacancy_title,
                    u_sup.full_name AS supervisor_name,
                    u_host.full_name AS host_supervisor_name
             FROM   placements p
             JOIN   users u_s   ON u_s.user_id  = p.student_id
             JOIN   host_organisations ho ON ho.org_id = p.org_id
             JOIN   host_vacancies hv     ON hv.vacancy_id = p.vacancy_id
             LEFT JOIN users u_sup  ON u_sup.user_id  = p.academic_supervisor_id
             LEFT JOIN users u_host ON u_host.user_id = p.host_supervisor_id
             WHERE  p.placement_id = :id'
        );
        $stmt->execute([':id' => $placement_id]);
        $placement = $stmt->fetch();

        if (!$placement) {
            Response::notFound('Placement not found.');
        }

        // Access check: only relevant parties can view
        $uid   = (int) $actor['user_id'];
        $roles = $actor['roles'];

        $can_view =
            in_array('leap_coordinator', $roles, true) ||
            in_array('management',       $roles, true) ||
            (int)$placement['student_id']             === $uid ||
            (int)$placement['academic_supervisor_id'] === $uid ||
            (int)$placement['host_supervisor_id']     === $uid;

        if (!$can_view) {
            Response::forbidden();
        }

        Response::success($placement);
    }

    /**
     * PATCH /placements/{id}/status
     * Update placement status through its lifecycle.
     *
     * coordinator_approved  → by leap_coordinator  (FR-04)
     * rejected              → by leap_coordinator
     * confirmed / rejected  → by host_supervisor   (FR-06)
     * active                → by leap_coordinator after host confirmation
     * completed             → by leap_coordinator
     * supervisor_allocated  → assigns academic_supervisor_id
     */
    public function updateStatus(int $placement_id): void {
        $actor = Auth::requireAuth();
        $body  = $this->getJsonBody();
        $roles = $actor['roles'];
        $uid   = (int) $actor['user_id'];

        $stmt = $this->db->prepare(
            'SELECT * FROM placements WHERE placement_id = :id'
        );
        $stmt->execute([':id' => $placement_id]);
        $placement = $stmt->fetch();

        if (!$placement) {
            Response::notFound('Placement not found.');
        }

        $new_status = $body['status'] ?? null;

        // Permission matrix for status transitions
        $allowed = $this->getAllowedTransitions($placement['status'], $roles, $uid, $placement);

        if (!in_array($new_status, $allowed, true)) {
            Response::forbidden(
                "Cannot transition from '{$placement['status']}' to '{$new_status}' with your role."
            );
        }

        $update_fields = ['status = :status', 'updated_at = NOW()'];
        $params        = [':status' => $new_status, ':id' => $placement_id];

        // When coordinator approves — generate placement letter (FR-05)
        if ($new_status === 'awaiting_host') {
            $this->generatePlacementLetter($placement_id, $uid, $placement);
        }

        // When coordinator assigns supervisor
        if (!empty($body['academic_supervisor_id'])) {
            $update_fields[] = 'academic_supervisor_id = :sup_id';
            $params[':sup_id'] = (int) $body['academic_supervisor_id'];
        }

        // When host assigns their supervisor
        if (!empty($body['host_supervisor_id'])) {
            $update_fields[] = 'host_supervisor_id = :host_sup';
            $params[':host_sup'] = (int) $body['host_supervisor_id'];
        }

        if (!empty($body['rejection_reason'])) {
            $update_fields[] = 'rejection_reason = :reason';
            $params[':reason'] = $body['rejection_reason'];
        }

        $sql = 'UPDATE placements SET ' . implode(', ', $update_fields) . ' WHERE placement_id = :id';
        $this->db->prepare($sql)->execute($params);

        // Increment vacancy filled_count when confirmed
        if ($new_status === 'confirmed') {
            $this->db->prepare(
                'UPDATE host_vacancies
                 SET    filled_count = filled_count + 1
                 WHERE  vacancy_id = :id AND filled_count < capacity'
            )->execute([':id' => $placement['vacancy_id']]);
        }

        $this->audit->log($uid, 'placement_status_updated', 'placement', $placement_id, [
            'from' => $placement['status'],
            'to'   => $new_status,
        ]);

        // Notify the student
        $this->notify(
            (int) $placement['student_id'],
            'Placement Update',
            "Your placement status has been updated to: {$new_status}."
        );

        Response::success(null, "Placement status updated to '{$new_status}'.");
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Returns which status values a user may transition to from the current state.
     */
    private function getAllowedTransitions(
        string $current, array $roles, int $uid, array $placement
    ): array {
        $is_coordinator    = in_array('leap_coordinator', $roles, true);
        $is_host_supervisor = in_array('host_supervisor', $roles, true)
                            && (int)$placement['host_supervisor_id'] === $uid;

        return match($current) {
            'pending' =>
                $is_coordinator ? ['coordinator_approved', 'awaiting_host', 'rejected'] : [],
            'coordinator_approved' =>
                $is_coordinator ? ['awaiting_host', 'rejected'] : [],
            'awaiting_host' =>
                $is_host_supervisor ? ['confirmed', 'rejected'] : [],
            'confirmed' =>
                $is_coordinator ? ['active', 'rejected'] : [],
            'active' =>
                $is_coordinator ? ['completed'] : [],
            default => [],
        };
    }

    /**
     * Generate a placement letter when coordinator sends request to host (FR-05).
     */
    private function generatePlacementLetter(int $placement_id, int $coordinator_id, array $placement): void {
        // Check a letter doesn't already exist
        $check = $this->db->prepare(
            'SELECT letter_id FROM placement_letters WHERE placement_id = :id'
        );
        $check->execute([':id' => $placement_id]);
        if ($check->fetch()) return;

        // Fetch student and org details for the letter
        $detail = $this->db->prepare(
            'SELECT u.full_name AS student_name, sp.student_number, sp.programme,
                    ho.org_name, hv.title AS position,
                    p.start_date, p.end_date
             FROM   placements p
             JOIN   users u              ON u.user_id    = p.student_id
             JOIN   student_profiles sp  ON sp.user_id   = p.student_id
             JOIN   host_organisations ho ON ho.org_id   = p.org_id
             JOIN   host_vacancies hv    ON hv.vacancy_id = p.vacancy_id
             WHERE  p.placement_id = :id'
        );
        $detail->execute([':id' => $placement_id]);
        $d = $detail->fetch();

        if (!$d) return;

        $letter = $this->buildLetterText($d);

        $this->db->prepare(
            'INSERT INTO placement_letters
                (placement_id, generated_by, letter_content, generated_at)
             VALUES (:pid, :gby, :content, NOW())'
        )->execute([
            ':pid'     => $placement_id,
            ':gby'     => $coordinator_id,
            ':content' => $letter,
        ]);
    }

    private function buildLetterText(array $d): string {
        $date  = date('d F Y');
        $start = $d['start_date'] ? date('d F Y', strtotime($d['start_date'])) : 'TBC';
        $end   = $d['end_date']   ? date('d F Y', strtotime($d['end_date']))   : 'TBC';

        return <<<LETTER
LIMKOKWING UNIVERSITY OF CREATIVE TECHNOLOGY
SIERRA LEONE

INTERNSHIP PLACEMENT LETTER
Date: {$date}

To Whom It May Concern,

This letter confirms that {$d['student_name']} (Student No: {$d['student_number']}) 
studying {$d['programme']} at Limkokwing University of Creative Technology, 
Sierra Leone, has been approved for an internship placement at {$d['org_name']}.

Position: {$d['position']}
Commencement Date: {$start}
Completion Date: {$end}

We kindly request your organisation to provide the student with a suitable 
learning environment and appropriate supervision throughout the internship period.

Yours sincerely,

LEAP / Internship Coordinator
Limkokwing University of Creative Technology
Sierra Leone
LETTER;
    }

    private function placementQuery(string $where_clause): string {
        return "SELECT p.placement_id, p.status, p.start_date, p.end_date,
                       p.preferred_sector, p.rejection_reason,
                       u_s.full_name AS student_name, u_s.email AS student_email,
                       ho.org_name, hv.title AS vacancy_title,
                       u_sup.full_name AS supervisor_name,
                       p.created_at, p.updated_at
                FROM   placements p
                JOIN   users u_s         ON u_s.user_id   = p.student_id
                JOIN   host_organisations ho ON ho.org_id = p.org_id
                JOIN   host_vacancies hv ON hv.vacancy_id = p.vacancy_id
                LEFT JOIN users u_sup    ON u_sup.user_id = p.academic_supervisor_id
                {$where_clause}
                ORDER  BY p.updated_at DESC";
    }

    private function notify(int $user_id, string $title, string $message): void {
        try {
            $this->db->prepare(
                'INSERT INTO notifications (recipient_id, title, message, type, created_at)
                 VALUES (:uid, :title, :msg, \'placement_update\', NOW())'
            )->execute([':uid' => $user_id, ':title' => $title, ':msg' => $message]);
        } catch (PDOException $e) {
            error_log('PlacementController::notify: ' . $e->getMessage());
        }
    }

    private function getJsonBody(): array {
        return json_decode(file_get_contents('php://input'), true) ?? [];
    }
}

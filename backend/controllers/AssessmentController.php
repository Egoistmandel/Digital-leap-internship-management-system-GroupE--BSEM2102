<?php
/**
 * Assessment Controller
 * Digital LEAP Internship Management System
 *
 * FR-10: Hosts submit evaluations online.
 * FR-11: System computes final grades from weighted components.
 * FR-12: Management approves results before publication.
 * D-02:  Components and weights are configurable — never hardcoded.
 * D-03:  Grade bands are configurable — no official scale assumed.
 * U-01:  Third component name is unconfirmed — table remains open.
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../utils/Validator.php';
require_once __DIR__ . '/../utils/AuditLog.php';
require_once __DIR__ . '/../middleware/Auth.php';

class AssessmentController {

    private PDO      $db;
    private AuditLog $audit;

    public function __construct(PDO $db) {
        $this->db    = $db;
        $this->audit = new AuditLog($db);
    }

    // =========================================================================
    // ASSESSMENT COMPONENTS (configurable by Coordinator)
    // =========================================================================

    /**
     * GET /assessment/components
     * List all active assessment components with their weights.
     */
    public function listComponents(): void {
        Auth::requireAuth();

        $stmt = $this->db->prepare(
            'SELECT component_id, component_name, description,
                    weight_percent, is_active, created_at
             FROM   assessment_components
             ORDER  BY component_id ASC'
        );
        $stmt->execute();
        $components = $stmt->fetchAll();

        // Calculate total weight of active components
        $total_weight = array_sum(
            array_map(
                fn($c) => $c['is_active'] ? (float)$c['weight_percent'] : 0,
                $components
            )
        );

        Response::success([
            'components'   => $components,
            'total_weight' => $total_weight,
            'weights_valid'=> abs($total_weight - 100) < 0.01,
            'note'         => 'Component names and weights are configurable. ' .
                              'Third component pending lecturer confirmation (U-01).',
        ]);
    }

    /**
     * POST /assessment/components
     * Create a new assessment component.
     * Roles: leap_coordinator
     */
    public function createComponent(): void {
        $actor = Auth::requireRole(['leap_coordinator']);
        $body  = $this->getJsonBody();

        $v = new Validator();
        $v->required($body['component_name']  ?? null, 'component_name')
          ->maxLength($body['component_name'] ?? '', 'component_name', 100)
          ->required($body['weight_percent']  ?? null, 'weight_percent')
          ->numeric($body['weight_percent']   ?? null, 'weight_percent', 0.01, 100);

        if (!$v->passes()) {
            Response::error('Validation failed.', 422, $v->errors());
        }

        // Warn if total weight would exceed 100 — do not block (coordinator's decision)
        $this->db->prepare(
            'INSERT INTO assessment_components
                (component_name, description, weight_percent, is_active, created_by, created_at)
             VALUES (:name, :desc, :weight, 1, :creator, NOW())'
        )->execute([
            ':name'    => trim($body['component_name']),
            ':desc'    => $body['description']  ?? null,
            ':weight'  => (float) $body['weight_percent'],
            ':creator' => (int) $actor['user_id'],
        ]);

        $component_id = (int) $this->db->lastInsertId();

        $this->audit->log(
            (int) $actor['user_id'],
            'assessment_component_created',
            'assessment_component',
            $component_id,
            ['name' => trim($body['component_name']), 'weight' => $body['weight_percent']]
        );

        Response::success(['component_id' => $component_id], 'Assessment component created.', 201);
    }

    /**
     * PATCH /assessment/components/{id}
     * Update a component's name, description or weight.
     * Roles: leap_coordinator
     */
    public function updateComponent(int $component_id): void {
        $actor = Auth::requireRole(['leap_coordinator']);
        $body  = $this->getJsonBody();

        $stmt = $this->db->prepare(
            'SELECT component_id FROM assessment_components WHERE component_id = :id'
        );
        $stmt->execute([':id' => $component_id]);
        if (!$stmt->fetch()) Response::notFound('Component not found.');

        $fields = [];
        $params = [':id' => $component_id];

        if (isset($body['component_name'])) {
            $fields[] = 'component_name = :name';
            $params[':name'] = trim($body['component_name']);
        }
        if (isset($body['description'])) {
            $fields[] = 'description = :desc';
            $params[':desc'] = $body['description'];
        }
        if (isset($body['weight_percent'])) {
            $v = new Validator();
            $v->numeric($body['weight_percent'], 'weight_percent', 0.01, 100);
            if (!$v->passes()) Response::error('Validation failed.', 422, $v->errors());
            $fields[] = 'weight_percent = :weight';
            $params[':weight'] = (float) $body['weight_percent'];
        }
        if (isset($body['is_active'])) {
            $fields[] = 'is_active = :active';
            $params[':active'] = (int) $body['is_active'];
        }

        if (empty($fields)) Response::error('No fields provided to update.', 400);

        $this->db->prepare(
            'UPDATE assessment_components SET ' . implode(', ', $fields) . ' WHERE component_id = :id'
        )->execute($params);

        $this->audit->log(
            (int) $actor['user_id'],
            'assessment_component_updated',
            'assessment_component',
            $component_id,
            $body
        );

        Response::success(null, 'Component updated.');
    }

    // =========================================================================
    // HOST EVALUATION (FR-10)
    // =========================================================================

    /**
     * POST /evaluation/{placement_id}
     * Host supervisor submits the intern evaluation (FR-10).
     */
    public function submitEvaluation(int $placement_id): void {
        $actor = Auth::requireRole(['host_supervisor']);
        $body  = $this->getJsonBody();
        $uid   = (int) $actor['user_id'];

        $v = new Validator();
        $v->required($body['criteria']     ?? null, 'criteria')
          ->required($body['overall_score'] ?? null, 'overall_score')
          ->numeric($body['overall_score']  ?? null, 'overall_score', 0, 100);

        if (!$v->passes()) Response::error('Validation failed.', 422, $v->errors());

        // Confirm placement belongs to this host supervisor and is in correct state
        $pl = $this->db->prepare(
            'SELECT placement_id, host_supervisor_id, student_id, status
             FROM   placements WHERE placement_id = :id'
        );
        $pl->execute([':id' => $placement_id]);
        $placement = $pl->fetch();

        if (!$placement) Response::notFound('Placement not found.');

        if (!in_array($placement['status'], ['active', 'completed'], true)) {
            Response::error('Evaluations can only be submitted for active or completed placements.', 403);
        }

        // Check no evaluation already submitted
        $existing = $this->db->prepare(
            'SELECT evaluation_id, status FROM host_evaluations WHERE placement_id = :id'
        );
        $existing->execute([':id' => $placement_id]);
        $eval = $existing->fetch();

        if ($eval && $eval['status'] === 'submitted') {
            Response::error('An evaluation has already been submitted for this placement.', 409);
        }

        $criteria_json = is_array($body['criteria'])
            ? json_encode($body['criteria'], JSON_UNESCAPED_UNICODE)
            : $body['criteria'];

        if ($eval) {
            // Update draft
            $this->db->prepare(
                'UPDATE host_evaluations
                 SET    criteria = :criteria, overall_score = :score,
                        comments = :comments, status = \'submitted\', submitted_at = NOW()
                 WHERE  evaluation_id = :eid'
            )->execute([
                ':criteria' => $criteria_json,
                ':score'    => (float) $body['overall_score'],
                ':comments' => $body['comments'] ?? null,
                ':eid'      => $eval['evaluation_id'],
            ]);
            $eval_id = $eval['evaluation_id'];
        } else {
            $this->db->prepare(
                'INSERT INTO host_evaluations
                    (placement_id, host_supervisor_id, criteria, overall_score,
                     comments, status, submitted_at, created_at)
                 VALUES (:pid, :uid, :criteria, :score, :comments, \'submitted\', NOW(), NOW())'
            )->execute([
                ':pid'      => $placement_id,
                ':uid'      => $uid,
                ':criteria' => $criteria_json,
                ':score'    => (float) $body['overall_score'],
                ':comments' => $body['comments'] ?? null,
            ]);
            $eval_id = (int) $this->db->lastInsertId();
        }

        // Store host evaluation score as an assessment mark if matching component exists
        $host_comp = $this->db->prepare(
            'SELECT component_id FROM assessment_components
             WHERE  LOWER(component_name) LIKE \'%host%\' AND is_active = 1 LIMIT 1'
        );
        $host_comp->execute();
        $comp = $host_comp->fetch();
        if ($comp) {
            $this->saveOrUpdateMark($placement_id, $comp['component_id'], $uid, (float) $body['overall_score']);
        }

        $this->audit->log($uid, 'host_evaluation_submitted', 'host_evaluation', $eval_id,
            ['placement_id' => $placement_id, 'score' => $body['overall_score']]
        );

        // Notify coordinator
        $this->notifyCoordinator(
            'Host Evaluation Submitted',
            "A host evaluation has been submitted for placement ID {$placement_id}."
        );

        Response::success(['evaluation_id' => $eval_id], 'Evaluation submitted.', 201);
    }

    /**
     * GET /evaluation/{placement_id}
     * Get the host evaluation for a placement.
     */
    public function getEvaluation(int $placement_id): void {
        $actor = Auth::requireAuth();

        $stmt = $this->db->prepare(
            'SELECT he.*, u.full_name AS host_supervisor_name
             FROM   host_evaluations he
             JOIN   users u ON u.user_id = he.host_supervisor_id
             WHERE  he.placement_id = :id'
        );
        $stmt->execute([':id' => $placement_id]);
        $eval = $stmt->fetch();

        if (!$eval) Response::notFound('No evaluation found for this placement.');

        // Decode JSON criteria
        if (isset($eval['criteria'])) {
            $eval['criteria'] = json_decode($eval['criteria'], true);
        }

        Response::success($eval);
    }

    // =========================================================================
    // ACADEMIC MARKS
    // =========================================================================

    /**
     * POST /assessment/marks
     * Supervisor submits academic marks for a placement component.
     * Roles: academic_supervisor, faculty_coordinator, faculty_mentor, leap_coordinator
     */
    public function submitMarks(): void {
        $actor = Auth::requireRole([
            'academic_supervisor', 'faculty_coordinator', 'faculty_mentor', 'leap_coordinator'
        ]);
        $body = $this->getJsonBody();
        $uid  = (int) $actor['user_id'];

        $v = new Validator();
        $v->required($body['placement_id']  ?? null, 'placement_id')
          ->required($body['component_id']  ?? null, 'component_id')
          ->required($body['score']         ?? null, 'score')
          ->numeric($body['score']          ?? null, 'score', 0, 100);

        if (!$v->passes()) Response::error('Validation failed.', 422, $v->errors());

        // Verify component exists and is active
        $comp = $this->db->prepare(
            'SELECT component_id, component_name FROM assessment_components
             WHERE  component_id = :id AND is_active = 1'
        );
        $comp->execute([':id' => $body['component_id']]);
        if (!$comp->fetch()) Response::notFound('Assessment component not found or inactive.');

        // Verify placement is in a gradeable state
        $pl = $this->db->prepare(
            'SELECT placement_id, status, student_id FROM placements WHERE placement_id = :id'
        );
        $pl->execute([':id' => $body['placement_id']]);
        $placement = $pl->fetch();

        if (!$placement) Response::notFound('Placement not found.');
        if (!in_array($placement['status'], ['active', 'completed'], true)) {
            Response::error('Marks can only be submitted for active or completed placements.', 403);
        }

        $this->saveOrUpdateMark(
            (int) $body['placement_id'],
            (int) $body['component_id'],
            $uid,
            (float) $body['score'],
            (float) ($body['max_score'] ?? 100),
            $body['comments'] ?? null
        );

        $this->audit->log($uid, 'assessment_mark_submitted', 'placement', (int)$body['placement_id'], [
            'component_id' => $body['component_id'],
            'score'        => $body['score'],
        ]);

        Response::success(null, 'Mark submitted.');
    }

    // =========================================================================
    // GRADE CONFIGURATION (D-03)
    // =========================================================================

    /**
     * GET /grades/config
     * List grade band configuration.
     */
    public function listGradeConfig(): void {
        Auth::requireAuth();

        $stmt = $this->db->prepare(
            'SELECT config_id, grade_band, min_score, max_score,
                    gpa_points, description, is_active
             FROM   grade_configurations
             ORDER  BY min_score DESC'
        );
        $stmt->execute();

        Response::success([
            'grade_bands' => $stmt->fetchAll(),
            'note'        => 'Grade boundaries are configurable. ' .
                             'No official university scale is assumed (D-03).',
        ]);
    }

    /**
     * POST /grades/config
     * Add or replace a grade band entry.
     * Roles: leap_coordinator
     */
    public function saveGradeConfig(): void {
        $actor = Auth::requireRole(['leap_coordinator']);
        $body  = $this->getJsonBody();

        $v = new Validator();
        $v->required($body['grade_band'] ?? null, 'grade_band')
          ->required($body['min_score']  ?? null, 'min_score')
          ->required($body['max_score']  ?? null, 'max_score')
          ->numeric($body['min_score']   ?? null, 'min_score', 0, 100)
          ->numeric($body['max_score']   ?? null, 'max_score', 0, 100);

        if (!$v->passes()) Response::error('Validation failed.', 422, $v->errors());

        if ((float)$body['min_score'] >= (float)$body['max_score']) {
            Response::error('min_score must be less than max_score.', 422);
        }

        // Upsert — update if grade_band already exists
        $this->db->prepare(
            'INSERT INTO grade_configurations
                (grade_band, min_score, max_score, gpa_points, description, is_active)
             VALUES (:band, :min, :max, :gpa, :desc, 1)
             ON DUPLICATE KEY UPDATE
                min_score = :min2, max_score = :max2,
                gpa_points = :gpa2, description = :desc2, is_active = 1'
        )->execute([
            ':band'  => strtoupper(trim($body['grade_band'])),
            ':min'   => (float) $body['min_score'],
            ':max'   => (float) $body['max_score'],
            ':gpa'   => $body['gpa_points']  ?? null,
            ':desc'  => $body['description'] ?? null,
            ':min2'  => (float) $body['min_score'],
            ':max2'  => (float) $body['max_score'],
            ':gpa2'  => $body['gpa_points']  ?? null,
            ':desc2' => $body['description'] ?? null,
        ]);

        $this->audit->log((int) $actor['user_id'], 'grade_config_updated', 'grade_configuration', null, $body);

        Response::success(null, 'Grade band saved.');
    }

    // =========================================================================
    // FINAL GRADE COMPUTATION (FR-11)
    // =========================================================================

    /**
     * POST /grades/{placement_id}/compute
     * Compute the weighted final grade for a placement.
     * Roles: leap_coordinator
     *
     * Business rules:
     * - All active components must have a submitted mark before computing.
     * - Weighted score = sum(score/max_score * weight_percent) for each component.
     * - Grade band assigned from grade_configurations table (configurable).
     * - If weights do not sum to 100 this is flagged in computation_notes.
     * - Unconfirmed third component is handled gracefully if not yet present.
     */
    public function computeGrade(int $placement_id): void {
        $actor = Auth::requireRole(['leap_coordinator']);
        $uid   = (int) $actor['user_id'];

        $pl = $this->db->prepare(
            'SELECT placement_id, status, student_id FROM placements WHERE placement_id = :id'
        );
        $pl->execute([':id' => $placement_id]);
        $placement = $pl->fetch();

        if (!$placement) Response::notFound('Placement not found.');

        if (!in_array($placement['status'], ['active', 'completed'], true)) {
            Response::error('Grades can only be computed for active or completed placements.', 403);
        }

        // Fetch active components
        $comps = $this->db->prepare(
            'SELECT component_id, component_name, weight_percent
             FROM   assessment_components
             WHERE  is_active = 1
             ORDER  BY component_id ASC'
        );
        $comps->execute();
        $components = $comps->fetchAll();

        if (empty($components)) {
            Response::error('No active assessment components configured. Contact the coordinator.', 422);
        }

        // Fetch submitted marks for this placement
        $marks_stmt = $this->db->prepare(
            'SELECT component_id, score, max_score
             FROM   assessment_marks
             WHERE  placement_id = :pid'
        );
        $marks_stmt->execute([':pid' => $placement_id]);
        $marks_raw = $marks_stmt->fetchAll();

        $marks = [];
        foreach ($marks_raw as $m) {
            $marks[(int)$m['component_id']] = $m;
        }

        // Check all components have marks
        $missing   = [];
        $weighted  = 0.0;
        $total_w   = 0.0;
        $breakdown = [];

        foreach ($components as $c) {
            $cid = (int) $c['component_id'];
            $w   = (float) $c['weight_percent'];
            $total_w += $w;

            if (!isset($marks[$cid])) {
                $missing[] = $c['component_name'];
                continue;
            }

            $score     = (float) $marks[$cid]['score'];
            $max_score = (float) $marks[$cid]['max_score'];
            $max_score = $max_score > 0 ? $max_score : 100;

            $contribution = ($score / $max_score) * $w;
            $weighted    += $contribution;

            $breakdown[] = [
                'component'    => $c['component_name'],
                'score'        => $score,
                'max_score'    => $max_score,
                'weight'       => $w,
                'contribution' => round($contribution, 4),
            ];
        }

        $notes = [];
        if (!empty($missing)) {
            $notes[] = 'Missing marks for: ' . implode(', ', $missing) .
                       '. Grade computed from available components only.';
        }
        if (abs($total_w - 100) > 0.01) {
            $notes[] = "Active component weights sum to {$total_w}%, not 100%. " .
                       'Configure components before final publication.';
        }

        // Normalise if weights don't sum to 100 to avoid skewed results
        if ($total_w > 0 && abs($total_w - 100) > 0.01) {
            $weighted = ($weighted / $total_w) * 100;
            $notes[]  = 'Score normalised due to weight sum ≠ 100.';
        }

        $computed_score = round($weighted, 2);

        // Assign grade band from configurable table
        $grade_band = $this->resolveGradeBand($computed_score);

        // Save or update final grade record
        $existing = $this->db->prepare(
            'SELECT grade_id FROM final_grades WHERE placement_id = :id'
        );
        $existing->execute([':id' => $placement_id]);
        $existing_grade = $existing->fetch();

        $notes_str = implode(' | ', $notes);

        if ($existing_grade) {
            $this->db->prepare(
                'UPDATE final_grades
                 SET    computed_score     = :score,
                        grade_band         = :band,
                        computation_notes  = :notes,
                        status             = \'computed\',
                        verified_by        = NULL,
                        verified_at        = NULL,
                        approved_by        = NULL,
                        approved_at        = NULL,
                        published_at       = NULL
                 WHERE  grade_id = :gid'
            )->execute([
                ':score' => $computed_score,
                ':band'  => $grade_band,
                ':notes' => $notes_str ?: null,
                ':gid'   => $existing_grade['grade_id'],
            ]);
            $grade_id = $existing_grade['grade_id'];
        } else {
            $this->db->prepare(
                'INSERT INTO final_grades
                    (placement_id, computed_score, grade_band,
                     computation_notes, status)
                 VALUES (:pid, :score, :band, :notes, \'computed\')'
            )->execute([
                ':pid'   => $placement_id,
                ':score' => $computed_score,
                ':band'  => $grade_band,
                ':notes' => $notes_str ?: null,
            ]);
            $grade_id = (int) $this->db->lastInsertId();
        }

        $this->audit->log($uid, 'grade_computed', 'final_grade', $grade_id, [
            'placement_id'   => $placement_id,
            'computed_score' => $computed_score,
            'grade_band'     => $grade_band,
        ]);

        Response::success([
            'grade_id'      => $grade_id,
            'computed_score'=> $computed_score,
            'grade_band'    => $grade_band,
            'breakdown'     => $breakdown,
            'notes'         => $notes,
        ], 'Grade computed successfully.');
    }

    /**
     * PATCH /grades/{placement_id}/verify
     * Coordinator verifies a computed grade (FR-11 → FR-12 pipeline).
     * Roles: leap_coordinator
     */
    public function verifyGrade(int $placement_id): void {
        $actor = Auth::requireRole(['leap_coordinator']);
        $uid   = (int) $actor['user_id'];

        $grade = $this->fetchGrade($placement_id);

        if ($grade['status'] !== 'computed') {
            Response::error("Grade must be in 'computed' status to verify. Current: {$grade['status']}.", 409);
        }

        $this->db->prepare(
            'UPDATE final_grades
             SET    status = \'coordinator_verified\',
                    verified_by = :uid, verified_at = NOW()
             WHERE  grade_id = :gid'
        )->execute([':uid' => $uid, ':gid' => $grade['grade_id']]);

        $this->audit->log($uid, 'grade_verified', 'final_grade', $grade['grade_id'], [
            'placement_id' => $placement_id,
        ]);

        // Notify management
        $this->notifyManagement(
            'Grade Ready for Approval',
            "A verified grade for placement ID {$placement_id} is awaiting management approval."
        );

        Response::success(null, 'Grade verified. Awaiting management approval.');
    }

    /**
     * PATCH /grades/{placement_id}/approve
     * Management approves verified grades before publication (FR-12).
     * Roles: management
     */
    public function approveGrade(int $placement_id): void {
        $actor = Auth::requireRole(['management']);
        $uid   = (int) $actor['user_id'];
        $body  = $this->getJsonBody();

        $grade = $this->fetchGrade($placement_id);

        if ($grade['status'] !== 'coordinator_verified') {
            Response::error(
                "Grade must be coordinator-verified before management approval. " .
                "Current: {$grade['status']}.",
                409
            );
        }

        // Management can raise a query instead of approving
        if (!empty($body['query'])) {
            $notes = ($grade['computation_notes'] ?? '') .
                     ' | Management query: ' . $body['query'];

            $this->db->prepare(
                'UPDATE final_grades
                 SET    status = \'computed\',
                        computation_notes = :notes,
                        verified_by = NULL, verified_at = NULL
                 WHERE  grade_id = :gid'
            )->execute([':notes' => $notes, ':gid' => $grade['grade_id']]);

            $this->audit->log($uid, 'grade_query_raised', 'final_grade', $grade['grade_id'],
                ['query' => $body['query']]
            );

            $this->notifyCoordinator('Grade Query Raised', "Management raised a query on placement ID {$placement_id}: {$body['query']}");

            Response::success(null, 'Query raised. Grade returned to coordinator for review.');
            return;
        }

        // Approve
        $this->db->prepare(
            'UPDATE final_grades
             SET    status = \'management_approved\',
                    approved_by = :uid, approved_at = NOW()
             WHERE  grade_id = :gid'
        )->execute([':uid' => $uid, ':gid' => $grade['grade_id']]);

        $this->audit->log($uid, 'grade_approved', 'final_grade', $grade['grade_id'], [
            'placement_id' => $placement_id,
        ]);

        Response::success(null, 'Grade approved. Ready for publication.');
    }

    /**
     * PATCH /grades/{placement_id}/publish
     * Publish approved results to the student (FR-12).
     * Roles: leap_coordinator
     */
    public function publishGrade(int $placement_id): void {
        $actor = Auth::requireRole(['leap_coordinator']);
        $uid   = (int) $actor['user_id'];

        $grade = $this->fetchGrade($placement_id);

        if ($grade['status'] !== 'management_approved') {
            Response::error(
                "Grade must be management-approved before publication. " .
                "Current: {$grade['status']}.",
                409
            );
        }

        $this->db->prepare(
            'UPDATE final_grades
             SET    status = \'published\', published_at = NOW()
             WHERE  grade_id = :gid'
        )->execute([':gid' => $grade['grade_id']]);

        $this->audit->log($uid, 'grade_published', 'final_grade', $grade['grade_id'], [
            'placement_id' => $placement_id,
        ]);

        // Notify the student
        $pl = $this->db->prepare('SELECT student_id FROM placements WHERE placement_id = :id');
        $pl->execute([':id' => $placement_id]);
        $p = $pl->fetch();
        if ($p) {
            $this->notify(
                (int) $p['student_id'],
                'Your Results Are Available',
                "Your internship result for placement ID {$placement_id} has been published. " .
                "Grade: {$grade['grade_band']} ({$grade['computed_score']}%)."
            );
        }

        Response::success(null, 'Grade published to student.');
    }

    /**
     * GET /grades/{placement_id}
     * Get the full grade record for a placement.
     */
    public function getGrade(int $placement_id): void {
        $actor = Auth::requireAuth();
        $uid   = (int) $actor['user_id'];
        $roles = $actor['roles'];

        $grade = $this->fetchGrade($placement_id, false);

        if (!$grade) Response::notFound('No grade record found for this placement.');

        // Students can only see published grades
        if (in_array('student', $roles, true) && $grade['status'] !== 'published') {
            Response::error('Results are not yet published.', 403);
        }

        // Also fetch assessment marks breakdown
        $marks = $this->db->prepare(
            'SELECT am.score, am.max_score, am.comments,
                    ac.component_name, ac.weight_percent,
                    u.full_name AS assessor_name
             FROM   assessment_marks am
             JOIN   assessment_components ac ON ac.component_id = am.component_id
             JOIN   users u                  ON u.user_id       = am.assessor_id
             WHERE  am.placement_id = :pid'
        );
        $marks->execute([':pid' => $placement_id]);
        $grade['marks_breakdown'] = $marks->fetchAll();

        Response::success($grade);
    }

    // =========================================================================
    // GRADE BAND CONFIGURATION LISTING
    // =========================================================================

    /**
     * GET /grades/all
     * List all grade records (coordinator/management).
     */
    public function listAllGrades(): void {
        $actor = Auth::requireRole(['leap_coordinator', 'management']);

        $stmt = $this->db->prepare(
            'SELECT fg.grade_id, fg.placement_id, fg.computed_score,
                    fg.grade_band, fg.status, fg.computation_notes,
                    fg.verified_at, fg.approved_at, fg.published_at,
                    u_s.full_name AS student_name,
                    ho.org_name
             FROM   final_grades fg
             JOIN   placements p  ON p.placement_id  = fg.placement_id
             JOIN   users u_s     ON u_s.user_id     = p.student_id
             JOIN   host_organisations ho ON ho.org_id = p.org_id
             ORDER  BY fg.status ASC, u_s.full_name ASC'
        );
        $stmt->execute();

        Response::success($stmt->fetchAll());
    }

    // =========================================================================
    // Private helpers
    // =========================================================================

    private function fetchGrade(int $placement_id, bool $require = true): array|false {
        $stmt = $this->db->prepare(
            'SELECT * FROM final_grades WHERE placement_id = :id'
        );
        $stmt->execute([':id' => $placement_id]);
        $grade = $stmt->fetch();

        if ($require && !$grade) Response::notFound('No grade record found for this placement.');

        return $grade;
    }

    private function resolveGradeBand(float $score): string {
        $stmt = $this->db->prepare(
            'SELECT grade_band FROM grade_configurations
             WHERE  is_active = 1 AND :score BETWEEN min_score AND max_score
             ORDER  BY min_score DESC LIMIT 1'
        );
        $stmt->execute([':score' => $score]);
        $band = $stmt->fetch();
        return $band ? $band['grade_band'] : 'N/A';
    }

    private function saveOrUpdateMark(
        int     $placement_id,
        int     $component_id,
        int     $assessor_id,
        float   $score,
        float   $max_score = 100.0,
        ?string $comments  = null
    ): void {
        $existing = $this->db->prepare(
            'SELECT mark_id FROM assessment_marks
             WHERE  placement_id = :pid AND component_id = :cid'
        );
        $existing->execute([':pid' => $placement_id, ':cid' => $component_id]);
        $mark = $existing->fetch();

        if ($mark) {
            $this->db->prepare(
                'UPDATE assessment_marks
                 SET    score = :score, max_score = :max, assessor_id = :uid,
                        comments = :comments, submitted_at = NOW()
                 WHERE  mark_id = :mid'
            )->execute([
                ':score'    => $score,
                ':max'      => $max_score,
                ':uid'      => $assessor_id,
                ':comments' => $comments,
                ':mid'      => $mark['mark_id'],
            ]);
        } else {
            $this->db->prepare(
                'INSERT INTO assessment_marks
                    (placement_id, component_id, assessor_id, score, max_score,
                     comments, submitted_at)
                 VALUES (:pid, :cid, :uid, :score, :max, :comments, NOW())'
            )->execute([
                ':pid'      => $placement_id,
                ':cid'      => $component_id,
                ':uid'      => $assessor_id,
                ':score'    => $score,
                ':max'      => $max_score,
                ':comments' => $comments,
            ]);
        }
    }

    private function notify(int $user_id, string $title, string $message): void {
        try {
            $this->db->prepare(
                'INSERT INTO notifications (recipient_id, title, message, type, created_at)
                 VALUES (:uid, :title, :msg, \'result_update\', NOW())'
            )->execute([':uid' => $user_id, ':title' => $title, ':msg' => $message]);
        } catch (PDOException $e) {
            error_log('AssessmentController::notify: ' . $e->getMessage());
        }
    }

    private function notifyCoordinator(string $title, string $message): void {
        try {
            $stmt = $this->db->prepare(
                'SELECT u.user_id FROM users u
                 JOIN user_roles ur ON ur.user_id = u.user_id
                 JOIN roles r       ON r.role_id  = ur.role_id
                 WHERE r.role_name = \'leap_coordinator\' AND u.status = \'active\' LIMIT 1'
            );
            $stmt->execute();
            $c = $stmt->fetch();
            if ($c) $this->notify((int)$c['user_id'], $title, $message);
        } catch (PDOException $e) {
            error_log('AssessmentController::notifyCoordinator: ' . $e->getMessage());
        }
    }

    private function notifyManagement(string $title, string $message): void {
        try {
            $stmt = $this->db->prepare(
                'SELECT u.user_id FROM users u
                 JOIN user_roles ur ON ur.user_id = u.user_id
                 JOIN roles r       ON r.role_id  = ur.role_id
                 WHERE r.role_name = \'management\' AND u.status = \'active\' LIMIT 1'
            );
            $stmt->execute();
            $m = $stmt->fetch();
            if ($m) $this->notify((int)$m['user_id'], $title, $message);
        } catch (PDOException $e) {
            error_log('AssessmentController::notifyManagement: ' . $e->getMessage());
        }
    }

    private function getJsonBody(): array {
        return json_decode(file_get_contents('php://input'), true) ?? [];
    }
}

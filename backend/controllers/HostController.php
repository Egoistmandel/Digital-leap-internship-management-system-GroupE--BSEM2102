<?php
/**
 * Host Organisation Controller
 * Digital LEAP Internship Management System
 *
 * Handles: list, create, approve, suspend host organisations.
 *          list, create, update vacancies.
 *
 * FR-02: Coordinator approves host accounts.
 * FR-04: Coordinator matches applications to host vacancies.
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../utils/Validator.php';
require_once __DIR__ . '/../utils/AuditLog.php';
require_once __DIR__ . '/../middleware/Auth.php';

class HostController {

    private PDO      $db;
    private AuditLog $audit;

    public function __construct(PDO $db) {
        $this->db    = $db;
        $this->audit = new AuditLog($db);
    }

    /**
     * GET /hosts
     * List host organisations. Coordinator sees all; others see approved only.
     */
    public function list(): void {
        $actor = Auth::requireAuth();
        $roles = $actor['roles'];

        $is_coordinator = in_array('leap_coordinator', $roles, true);

        if ($is_coordinator) {
            $stmt = $this->db->prepare(
                'SELECT org_id, org_name, industry, address,
                        contact_name, contact_email, contact_phone,
                        status, created_at
                 FROM   host_organisations
                 ORDER  BY org_name ASC'
            );
            $stmt->execute();
        } else {
            $stmt = $this->db->prepare(
                'SELECT org_id, org_name, industry, address,
                        contact_name, contact_email, contact_phone,
                        status, created_at
                 FROM   host_organisations
                 WHERE  status = \'approved\'
                 ORDER  BY org_name ASC'
            );
            $stmt->execute();
        }

        Response::success($stmt->fetchAll());
    }

    /**
     * POST /hosts
     * Register a new host organisation (pending approval).
     * Roles: leap_coordinator, host_supervisor
     */
    public function create(): void {
        $actor = Auth::requireRole(['leap_coordinator', 'host_supervisor']);
        $body  = $this->getJsonBody();

        $v = new Validator();
        $v->required($body['org_name']      ?? null, 'org_name')
          ->maxLength($body['org_name']      ?? '', 'org_name', 200)
          ->required($body['contact_email']  ?? null, 'contact_email')
          ->email($body['contact_email']     ?? null, 'contact_email');

        if (!$v->passes()) {
            Response::error('Validation failed.', 422, $v->errors());
        }

        $stmt = $this->db->prepare(
            'INSERT INTO host_organisations
                (org_name, industry, address, contact_name,
                 contact_email, contact_phone, status, created_at)
             VALUES
                (:org_name, :industry, :address, :contact_name,
                 :contact_email, :contact_phone, \'pending\', NOW())'
        );
        $stmt->execute([
            ':org_name'      => trim($body['org_name']),
            ':industry'      => $body['industry']      ?? null,
            ':address'       => $body['address']       ?? null,
            ':contact_name'  => $body['contact_name']  ?? null,
            ':contact_email' => strtolower(trim($body['contact_email'])),
            ':contact_phone' => $body['contact_phone'] ?? null,
        ]);

        $org_id = (int) $this->db->lastInsertId();

        $this->audit->log(
            (int) $actor['user_id'],
            'host_created',
            'host_organisation',
            $org_id,
            ['org_name' => trim($body['org_name'])]
        );

        Response::success(['org_id' => $org_id], 'Host organisation registered. Pending coordinator approval.', 201);
    }

    /**
     * GET /hosts/{id}
     * Get a single host organisation with its vacancies.
     */
    public function get(int $org_id): void {
        Auth::requireAuth();

        $stmt = $this->db->prepare(
            'SELECT org_id, org_name, industry, address,
                    contact_name, contact_email, contact_phone,
                    status, created_at
             FROM   host_organisations
             WHERE  org_id = :id'
        );
        $stmt->execute([':id' => $org_id]);
        $org = $stmt->fetch();

        if (!$org) {
            Response::notFound('Host organisation not found.');
        }

        // Attach vacancies
        $v_stmt = $this->db->prepare(
            'SELECT vacancy_id, title, description, capacity,
                    filled_count, start_date, end_date, is_active
             FROM   host_vacancies
             WHERE  org_id = :id
             ORDER  BY created_at DESC'
        );
        $v_stmt->execute([':id' => $org_id]);
        $org['vacancies'] = $v_stmt->fetchAll();

        Response::success($org);
    }

    /**
     * PATCH /hosts/{id}/status
     * Approve or suspend a host organisation.
     * Roles: leap_coordinator
     */
    public function updateStatus(int $org_id): void {
        $actor = Auth::requireRole(['leap_coordinator']);
        $body  = $this->getJsonBody();

        $v = new Validator();
        $v->required($body['status'] ?? null, 'status')
          ->inList($body['status'] ?? null, 'status', ['approved', 'suspended', 'pending']);

        if (!$v->passes()) {
            Response::error('Validation failed.', 422, $v->errors());
        }

        $stmt = $this->db->prepare(
            'SELECT org_id FROM host_organisations WHERE org_id = :id'
        );
        $stmt->execute([':id' => $org_id]);

        if (!$stmt->fetch()) {
            Response::notFound('Host organisation not found.');
        }

        $approved_by = $body['status'] === 'approved' ? $actor['user_id'] : null;
        $approved_at = $body['status'] === 'approved' ? date('Y-m-d H:i:s') : null;

        $this->db->prepare(
            'UPDATE host_organisations
             SET    status      = :status,
                    approved_by = :approved_by,
                    approved_at = :approved_at
             WHERE  org_id = :id'
        )->execute([
            ':status'      => $body['status'],
            ':approved_by' => $approved_by,
            ':approved_at' => $approved_at,
            ':id'          => $org_id,
        ]);

        $this->audit->log(
            (int) $actor['user_id'],
            'host_status_updated',
            'host_organisation',
            $org_id,
            ['status' => $body['status']]
        );

        Response::success(null, 'Host organisation status updated.');
    }

    /**
     * POST /hosts/{id}/vacancies
     * Add a vacancy to a host organisation.
     * Roles: leap_coordinator, host_supervisor
     */
    public function addVacancy(int $org_id): void {
        $actor = Auth::requireRole(['leap_coordinator', 'host_supervisor']);
        $body  = $this->getJsonBody();

        $v = new Validator();
        $v->required($body['title']    ?? null, 'title')
          ->maxLength($body['title']   ?? '', 'title', 150)
          ->required($body['capacity'] ?? null, 'capacity')
          ->numeric($body['capacity']  ?? null, 'capacity', 1, 50);

        if (!empty($body['start_date'])) $v->date($body['start_date'], 'start_date');
        if (!empty($body['end_date']))   $v->date($body['end_date'],   'end_date');

        if (!$v->passes()) {
            Response::error('Validation failed.', 422, $v->errors());
        }

        // Confirm org exists and is approved
        $stmt = $this->db->prepare(
            'SELECT org_id FROM host_organisations WHERE org_id = :id AND status = \'approved\''
        );
        $stmt->execute([':id' => $org_id]);
        if (!$stmt->fetch()) {
            Response::error('Host organisation not found or not approved.', 404);
        }

        $this->db->prepare(
            'INSERT INTO host_vacancies
                (org_id, title, description, capacity, start_date, end_date, is_active, created_at)
             VALUES
                (:org_id, :title, :desc, :capacity, :start_date, :end_date, 1, NOW())'
        )->execute([
            ':org_id'     => $org_id,
            ':title'      => trim($body['title']),
            ':desc'       => $body['description'] ?? null,
            ':capacity'   => (int) $body['capacity'],
            ':start_date' => $body['start_date']  ?? null,
            ':end_date'   => $body['end_date']    ?? null,
        ]);

        $vacancy_id = (int) $this->db->lastInsertId();

        $this->audit->log(
            (int) $actor['user_id'],
            'vacancy_created',
            'host_vacancy',
            $vacancy_id,
            ['org_id' => $org_id, 'title' => trim($body['title'])]
        );

        Response::success(['vacancy_id' => $vacancy_id], 'Vacancy added.', 201);
    }

    private function getJsonBody(): array {
        return json_decode(file_get_contents('php://input'), true) ?? [];
    }
}

<?php
/**
 * Report Controller
 * Digital LEAP Internship Management System
 *
 * FR-14: Coordinator and Management generate progress and summary reports.
 *
 * Three reports:
 *   1. Placement Report  — all placements with status breakdown
 *   2. Progress Report   — logbook completion, visit completion per placement
 *   3. Results Report    — final grades and pass/fail summary
 *
 * All reports return structured JSON that the frontend renders into
 * human-readable tables. No PDF generation in this milestone.
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../middleware/Auth.php';

class ReportController {

    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    /**
     * GET /reports/placements
     * Summary of all placements grouped by status.
     * Roles: leap_coordinator, management, faculty_coordinator
     */
    public function placements(): void {
        Auth::requireRole(['leap_coordinator', 'management', 'faculty_coordinator']);

        // Status breakdown counts
        $counts = $this->db->prepare(
            'SELECT status, COUNT(*) AS count
             FROM   placements
             GROUP  BY status'
        );
        $counts->execute();
        $status_summary = $counts->fetchAll();

        // Per-placement detail
        $detail = $this->db->prepare(
            'SELECT p.placement_id,
                    u_s.full_name   AS student_name,
                    u_s.email       AS student_email,
                    sp.student_number,
                    sp.programme,
                    ho.org_name,
                    ho.industry,
                    hv.title        AS vacancy_title,
                    u_sup.full_name AS supervisor_name,
                    p.status,
                    p.start_date,
                    p.end_date,
                    p.created_at
             FROM   placements p
             JOIN   users u_s         ON u_s.user_id    = p.student_id
             LEFT JOIN student_profiles sp ON sp.user_id = p.student_id
             JOIN   host_organisations ho  ON ho.org_id  = p.org_id
             JOIN   host_vacancies hv      ON hv.vacancy_id = p.vacancy_id
             LEFT JOIN users u_sup    ON u_sup.user_id  = p.academic_supervisor_id
             ORDER  BY p.status ASC, u_s.full_name ASC'
        );
        $detail->execute();

        Response::success([
            'generated_at'   => date('Y-m-d H:i:s'),
            'report_type'    => 'placement_summary',
            'status_summary' => $status_summary,
            'placements'     => $detail->fetchAll(),
            'total'          => array_sum(array_column($status_summary, 'count')),
        ]);
    }

    /**
     * GET /reports/progress
     * Logbook and visit completion per active/completed placement.
     * Roles: leap_coordinator, management, faculty_coordinator
     */
    public function progress(): void {
        Auth::requireRole(['leap_coordinator', 'management', 'faculty_coordinator']);

        $stmt = $this->db->prepare(
            'SELECT p.placement_id,
                    u_s.full_name  AS student_name,
                    sp.student_number,
                    ho.org_name,
                    p.status        AS placement_status,
                    p.start_date,
                    p.end_date,

                    -- Logbook metrics
                    COUNT(DISTINCT le.entry_id)                            AS logbook_entries_total,
                    SUM(CASE WHEN le.status = \'approved\'     THEN 1 ELSE 0 END) AS logbook_approved,
                    SUM(CASE WHEN le.status = \'submitted\'    THEN 1 ELSE 0 END) AS logbook_pending_review,
                    SUM(CASE WHEN le.status = \'revision_requested\' THEN 1 ELSE 0 END)
                                                                           AS logbook_revision_needed,
                    COALESCE(SUM(le.hours_worked), 0)                      AS total_hours_logged,

                    -- Visit metrics
                    COUNT(DISTINCT sv.visit_id)                            AS visits_total,
                    SUM(CASE WHEN sv.status = \'completed\' THEN 1 ELSE 0 END) AS visits_completed,
                    SUM(CASE WHEN sv.status = \'scheduled\' THEN 1 ELSE 0 END) AS visits_scheduled,

                    -- Attendance
                    COUNT(DISTINCT g.attendance_id)                        AS attendance_records,
                    SUM(CASE WHEN g.verified_status = \'verified\' THEN 1 ELSE 0 END)
                                                                           AS attendance_verified

             FROM   placements p
             JOIN   users u_s             ON u_s.user_id    = p.student_id
             LEFT JOIN student_profiles sp ON sp.user_id    = p.student_id
             JOIN   host_organisations ho  ON ho.org_id     = p.org_id
             LEFT JOIN logbook_entries le  ON le.placement_id = p.placement_id
             LEFT JOIN supervisory_visits sv ON sv.placement_id = p.placement_id
             LEFT JOIN gps_attendance_records g ON g.placement_id = p.placement_id
             WHERE  p.status IN (\'confirmed\', \'active\', \'completed\')
             GROUP  BY p.placement_id
             ORDER  BY u_s.full_name ASC'
        );
        $stmt->execute();
        $rows = $stmt->fetchAll();

        // Add completion percentage per row
        foreach ($rows as &$row) {
            $total = max((int)$row['logbook_entries_total'], 1);
            $row['logbook_completion_pct'] = round(
                ((int)$row['logbook_approved'] / $total) * 100
            );
        }

        Response::success([
            'generated_at' => date('Y-m-d H:i:s'),
            'report_type'  => 'progress_summary',
            'placements'   => $rows,
            'total'        => count($rows),
        ]);
    }

    /**
     * GET /reports/results
     * Final grades summary.
     * Roles: leap_coordinator, management
     */
    public function results(): void {
        Auth::requireRole(['leap_coordinator', 'management']);

        $stmt = $this->db->prepare(
            'SELECT fg.grade_id,
                    u_s.full_name  AS student_name,
                    sp.student_number,
                    sp.programme,
                    ho.org_name,
                    fg.computed_score,
                    fg.grade_band,
                    fg.status      AS grade_status,
                    fg.published_at,
                    fg.computation_notes
             FROM   final_grades fg
             JOIN   placements p  ON p.placement_id  = fg.placement_id
             JOIN   users u_s     ON u_s.user_id      = p.student_id
             LEFT JOIN student_profiles sp ON sp.user_id = p.student_id
             JOIN   host_organisations ho  ON ho.org_id  = p.org_id
             ORDER  BY fg.status ASC, u_s.full_name ASC'
        );
        $stmt->execute();
        $grades = $stmt->fetchAll();

        // Grade band frequency table
        $band_summary = [];
        $pass_count   = 0;
        $fail_count   = 0;

        foreach ($grades as $g) {
            $band = $g['grade_band'] ?? 'N/A';
            $band_summary[$band] = ($band_summary[$band] ?? 0) + 1;

            if ($band === 'F' || $band === 'N/A') {
                $fail_count++;
            } else {
                $pass_count++;
            }
        }

        // Average score (published grades only)
        $published = array_filter($grades, fn($g) => $g['grade_status'] === 'published');
        $avg_score = count($published) > 0
            ? round(
                array_sum(array_column(array_values($published), 'computed_score'))
                / count($published),
                2
              )
            : null;

        Response::success([
            'generated_at'  => date('Y-m-d H:i:s'),
            'report_type'   => 'results_summary',
            'grades'        => $grades,
            'total'         => count($grades),
            'published'     => count($published),
            'pass_count'    => $pass_count,
            'fail_count'    => $fail_count,
            'average_score' => $avg_score,
            'band_summary'  => $band_summary,
            'note'          => 'Grade bands are configurable. ' .
                               'Pass/fail classification uses F and N/A as fail indicators.',
        ]);
    }
}

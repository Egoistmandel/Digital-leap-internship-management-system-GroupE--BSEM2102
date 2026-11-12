-- =============================================================================
-- Database Validation Tests
-- Digital LEAP Internship Management System
-- =============================================================================
-- PURPOSE : Verify database constraints, relationships and business rules.
-- HOW TO USE : Run each block in phpMyAdmin or MySQL Workbench after running
--              schema.sql and seed_data.sql. Confirm expected results match.
-- =============================================================================

USE digital_leap;

-- ---------------------------------------------------------------------------
-- VT-01: Confirm all 7 roles are seeded correctly
-- Expected: 7 rows returned
-- ---------------------------------------------------------------------------
SELECT 'VT-01' AS test, COUNT(*) AS actual, 7 AS expected,
       IF(COUNT(*) = 7, 'PASS', 'FAIL') AS result
FROM roles;

-- ---------------------------------------------------------------------------
-- VT-02: Confirm seed users exist and have correct statuses
-- Expected: 7 active users + 1 pending
-- ---------------------------------------------------------------------------
SELECT 'VT-02 active' AS test, COUNT(*) AS actual, 7 AS expected,
       IF(COUNT(*) = 7, 'PASS', 'FAIL') AS result
FROM users WHERE status = 'active';

SELECT 'VT-02 pending' AS test, COUNT(*) AS actual, 1 AS expected,
       IF(COUNT(*) = 1, 'PASS', 'FAIL') AS result
FROM users WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- VT-03: Confirm passwords are never stored in plaintext
-- Expected: 0 rows where password_hash looks like a plain password
-- ---------------------------------------------------------------------------
SELECT 'VT-03' AS test, COUNT(*) AS actual, 0 AS expected,
       IF(COUNT(*) = 0, 'PASS', 'FAIL') AS result
FROM users
WHERE password_hash NOT LIKE '$2y$%';

-- ---------------------------------------------------------------------------
-- VT-04: Confirm user_roles FK integrity
-- Expected: 0 orphaned role assignments
-- ---------------------------------------------------------------------------
SELECT 'VT-04' AS test, COUNT(*) AS actual, 0 AS expected,
       IF(COUNT(*) = 0, 'PASS', 'FAIL') AS result
FROM user_roles ur
LEFT JOIN users u ON u.user_id = ur.user_id
WHERE u.user_id IS NULL;

-- ---------------------------------------------------------------------------
-- VT-05: Confirm UNIQUE constraint on (placement_id, week_number) in logbook
-- Expected: Error on duplicate insert (run manually to verify constraint)
-- ---------------------------------------------------------------------------
-- This test must be run manually. Expected: MySQL error 1062 (Duplicate entry)
-- INSERT INTO logbook_entries
--   (placement_id, student_id, week_number, entry_date, activities, hours_worked)
-- VALUES (1, 2, 1, '2027-01-10', 'Test', 8);  -- Run twice to trigger error

SELECT 'VT-05' AS test,
       'Manual test required — insert duplicate week_number for same placement_id' AS instruction,
       'Expected: MySQL Error 1062' AS expected_error;

-- ---------------------------------------------------------------------------
-- VT-06: Confirm GPS consent CHECK constraint
-- Expected: MySQL error on consent_given = 0 insert
-- ---------------------------------------------------------------------------
-- Run manually — expected: Error 3819 (CHECK constraint violated)
-- INSERT INTO gps_attendance_records
--   (placement_id, student_id, recorded_at, latitude, longitude, consent_given)
-- VALUES (1, 2, NOW(), 8.4657, -13.2317, 0);

SELECT 'VT-06' AS test,
       'Manual test required — insert consent_given = 0' AS instruction,
       'Expected: MySQL Error 3819 CHECK constraint' AS expected_error;

-- ---------------------------------------------------------------------------
-- VT-07: Confirm grade_configurations boundaries are valid (min < max)
-- Expected: 0 invalid rows
-- ---------------------------------------------------------------------------
SELECT 'VT-07' AS test, COUNT(*) AS actual, 0 AS expected,
       IF(COUNT(*) = 0, 'PASS', 'FAIL') AS result
FROM grade_configurations
WHERE min_score >= max_score;

-- ---------------------------------------------------------------------------
-- VT-08: Confirm host vacancies filled_count never exceeds capacity
-- Expected: 0 violations
-- ---------------------------------------------------------------------------
SELECT 'VT-08' AS test, COUNT(*) AS actual, 0 AS expected,
       IF(COUNT(*) = 0, 'PASS', 'FAIL') AS result
FROM host_vacancies
WHERE filled_count > capacity;

-- ---------------------------------------------------------------------------
-- VT-09: Confirm all foreign keys resolve (no orphaned placements)
-- Expected: 0 orphaned placements
-- ---------------------------------------------------------------------------
SELECT 'VT-09' AS test, COUNT(*) AS actual, 0 AS expected,
       IF(COUNT(*) = 0, 'PASS', 'FAIL') AS result
FROM placements p
LEFT JOIN users u ON u.user_id = p.student_id
WHERE u.user_id IS NULL;

-- ---------------------------------------------------------------------------
-- VT-10: Confirm assessment mark score never exceeds max_score
-- Expected: 0 violations
-- ---------------------------------------------------------------------------
SELECT 'VT-10' AS test, COUNT(*) AS actual, 0 AS expected,
       IF(COUNT(*) = 0, 'PASS', 'FAIL') AS result
FROM assessment_marks
WHERE score > max_score;

-- ---------------------------------------------------------------------------
-- VT-11: Confirm hours_worked is within valid range (0–168)
-- Expected: 0 violations
-- ---------------------------------------------------------------------------
SELECT 'VT-11' AS test, COUNT(*) AS actual, 0 AS expected,
       IF(COUNT(*) = 0, 'PASS', 'FAIL') AS result
FROM logbook_entries
WHERE hours_worked < 0 OR hours_worked > 168;

-- ---------------------------------------------------------------------------
-- VT-12: Confirm audit_log is populated with seed login events
-- (Will populate after first login — run after TC-03)
-- ---------------------------------------------------------------------------
SELECT 'VT-12' AS test, COUNT(*) AS actual, '>= 0' AS expected,
       'Review audit_logs after performing test logins' AS instruction
FROM audit_logs;

-- ---------------------------------------------------------------------------
-- VT-13: Confirm indexes exist on key lookup columns
-- Expected: Index entries for users.email, placements.student_id, etc.
-- ---------------------------------------------------------------------------
SHOW INDEX FROM users        WHERE Key_name = 'idx_users_email';
SHOW INDEX FROM placements   WHERE Key_name = 'idx_placements_student';
SHOW INDEX FROM logbook_entries WHERE Key_name = 'idx_logbook_placement';
SHOW INDEX FROM notifications   WHERE Key_name = 'idx_notif_recipient';
SHOW INDEX FROM audit_logs      WHERE Key_name = 'idx_audit_user';

-- ---------------------------------------------------------------------------
-- VT-14: Confirm grade_band UNIQUE constraint on grade_configurations
-- Expected: 0 duplicate grade bands
-- ---------------------------------------------------------------------------
SELECT 'VT-14' AS test, COUNT(*) AS duplicates, 0 AS expected,
       IF(COUNT(*) = 0, 'PASS', 'FAIL') AS result
FROM (
    SELECT grade_band, COUNT(*) AS cnt
    FROM   grade_configurations
    GROUP  BY grade_band
    HAVING cnt > 1
) dup;

-- ---------------------------------------------------------------------------
-- VT-15: Final summary — table row counts after seeding
-- ---------------------------------------------------------------------------
SELECT 'roles'                   AS table_name, COUNT(*) AS rows FROM roles
UNION ALL
SELECT 'users',                                 COUNT(*) FROM users
UNION ALL
SELECT 'user_roles',                            COUNT(*) FROM user_roles
UNION ALL
SELECT 'host_organisations',                    COUNT(*) FROM host_organisations
UNION ALL
SELECT 'host_vacancies',                        COUNT(*) FROM host_vacancies
UNION ALL
SELECT 'student_profiles',                      COUNT(*) FROM student_profiles
UNION ALL
SELECT 'placements',                            COUNT(*) FROM placements
UNION ALL
SELECT 'grade_configurations',                  COUNT(*) FROM grade_configurations
UNION ALL
SELECT 'audit_logs',                            COUNT(*) FROM audit_logs
UNION ALL
SELECT 'notifications',                         COUNT(*) FROM notifications;

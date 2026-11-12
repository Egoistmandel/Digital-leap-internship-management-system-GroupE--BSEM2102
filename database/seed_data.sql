-- =============================================================================
-- Digital LEAP Internship Management System
-- Development Seed Data
-- =============================================================================
-- PURPOSE : Provides sample data for local development and demonstration.
-- WARNING : Do NOT run this script in production.
-- Passwords: All set to 'Password123!' — change before any real use.
-- Hash generated with: password_hash('Password123!', PASSWORD_BCRYPT, ['cost'=>12])
-- =============================================================================

USE digital_leap;

-- =============================================================================
-- SEED USERS (one per role)
-- =============================================================================
-- Hash is bcrypt of 'Password123!' generated with cost=12
INSERT INTO users (full_name, email, password_hash, status) VALUES
-- 1. LEAP Coordinator
('Amara Koroma',       'coordinator@leap.sl',  '$2y$12$Fr16HcBw1sRIn5766MfqcuzvLfK4py1Q0AAfBV0LvRWZUcamujoYu', 'active'),
-- 2. Student
('Fatmata Sesay',      'student@leap.sl',       '$2y$12$Fr16HcBw1sRIn5766MfqcuzvLfK4py1Q0AAfBV0LvRWZUcamujoYu', 'active'),
-- 3. Academic Supervisor
('Ibrahim Bangura',    'supervisor@leap.sl',    '$2y$12$Fr16HcBw1sRIn5766MfqcuzvLfK4py1Q0AAfBV0LvRWZUcamujoYu', 'active'),
-- 4. Faculty Coordinator
('Mariama Conteh',     'fcoord@leap.sl',        '$2y$12$Fr16HcBw1sRIn5766MfqcuzvLfK4py1Q0AAfBV0LvRWZUcamujoYu', 'active'),
-- 5. Faculty Mentor
('Mohamed Kamara',     'mentor@leap.sl',        '$2y$12$Fr16HcBw1sRIn5766MfqcuzvLfK4py1Q0AAfBV0LvRWZUcamujoYu', 'active'),
-- 6. Host Supervisor
('Agnes Turay',        'hostsup@leap.sl',       '$2y$12$Fr16HcBw1sRIn5766MfqcuzvLfK4py1Q0AAfBV0LvRWZUcamujoYu', 'active'),
-- 7. Management
('Principal Kalokoh',  'management@leap.sl',    '$2y$12$Fr16HcBw1sRIn5766MfqcuzvLfK4py1Q0AAfBV0LvRWZUcamujoYu', 'active'),
-- 8. Pending student (not yet approved)
('Binta Jalloh',       'pending@leap.sl',       '$2y$12$Fr16HcBw1sRIn5766MfqcuzvLfK4py1Q0AAfBV0LvRWZUcamujoYu', 'pending');

-- =============================================================================
-- ASSIGN ROLES
-- =============================================================================
INSERT INTO user_roles (user_id, role_id) VALUES
(1, 2),  -- Amara       → leap_coordinator
(2, 1),  -- Fatmata     → student
(3, 3),  -- Ibrahim     → academic_supervisor
(4, 4),  -- Mariama     → faculty_coordinator
(5, 5),  -- Mohamed     → faculty_mentor
(6, 6),  -- Agnes       → host_supervisor
(7, 7),  -- Kalokoh     → management
(8, 1);  -- Binta       → student (pending)

-- =============================================================================
-- STUDENT PROFILES
-- =============================================================================
INSERT INTO student_profiles (user_id, student_number, programme, semester, phone, eligibility, verified_by, verified_at) VALUES
(2, 'BSEM1202-00001', 'BSc Entrepreneurship Management', 5, '+232-76-111222', 'eligible',   1, NOW()),
(8, 'BSEM1202-00002', 'BSc Entrepreneurship Management', 5, '+232-76-333444', 'not_verified', NULL, NULL);

-- =============================================================================
-- HOST ORGANISATION
-- =============================================================================
INSERT INTO host_organisations (org_name, industry, address, contact_name, contact_email, contact_phone, approved_by, approved_at, status) VALUES
('Sierra Leone Tech Hub', 'Technology', '12 Wilberforce Street, Freetown', 'Agnes Turay', 'agnes@sltech.sl', '+232-77-500600', 1, NOW(), 'approved');

-- =============================================================================
-- HOST VACANCY
-- =============================================================================
INSERT INTO host_vacancies (org_id, title, description, capacity, start_date, end_date, is_active) VALUES
(1, 'Software Development Intern', 'Assist with web and mobile application development projects.', 2, '2027-01-06', '2027-04-04', 1);

-- =============================================================================
-- PLACEMENT (sample — pending state)
-- =============================================================================
INSERT INTO placements (student_id, vacancy_id, org_id, coordinator_id, preferred_sector, status, start_date, end_date) VALUES
(2, 1, 1, 1, 'Technology', 'pending', '2027-01-06', '2027-04-04');

-- =============================================================================
-- GRADE CONFIGURATION (placeholder — official boundaries NOT confirmed)
-- These values are examples only. The coordinator must configure actual bands.
-- See D-03: grade boundaries are configurable, no official scale is assumed.
-- =============================================================================
INSERT INTO grade_configurations (grade_band, min_score, max_score, gpa_points, description, is_active) VALUES
('A',  70.00, 100.00, 4.00, 'Distinction  — PLACEHOLDER, confirm with university', 1),
('B',  60.00,  69.99, 3.00, 'Merit        — PLACEHOLDER, confirm with university', 1),
('C',  50.00,  59.99, 2.00, 'Pass         — PLACEHOLDER, confirm with university', 1),
('D',  40.00,  49.99, 1.00, 'Borderline   — PLACEHOLDER, confirm with university', 1),
('F',   0.00,  39.99, 0.00, 'Fail         — PLACEHOLDER, confirm with university', 1);

-- =============================================================================
-- NOTE ON ASSESSMENT COMPONENTS
-- Not seeded here because component names and weights are unconfirmed (U-01, U-02).
-- The coordinator will configure components via the system UI once confirmed.
-- =============================================================================

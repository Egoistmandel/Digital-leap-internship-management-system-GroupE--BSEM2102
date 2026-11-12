# Test Cases
## Digital LEAP Internship Management System
**Course:** COMP 217 — System Analysis and Design  
**Group:** Group E | **Semester:** 05 (September 2026 – February 2027)

---

## Test Environment Setup

1. Start XAMPP — Apache and MySQL running.
2. Run `schema.sql` to create database and tables.
3. Run `seed_data.sql` to load development data.
4. Backend base URL: `http://localhost/digital-leap-api`
5. Test tool: Postman or curl (Windows CMD).

**Seed user credentials (all use password: `Password123!`):**

| Role | Email |
|---|---|
| LEAP Coordinator | coordinator@leap.sl |
| Student | student@leap.sl |
| Academic Supervisor | supervisor@leap.sl |
| Host Supervisor | hostsup@leap.sl |
| Management | management@leap.sl |

---

## TC-01: User Registration — Valid Input

**Requirement:** FR1 (register users)  
**Type:** Functional — API

**Input:**
```json
POST /auth/register
{
  "full_name": "Test Student",
  "email":     "test@leap.sl",
  "password":  "SecurePass1!",
  "role":      "student"
}
```

**Expected Result:**
- HTTP 201
- `success: true`
- `message` contains "pending approval"
- Database: new row in `users` with `status = 'pending'`

**Pass / Fail:** ___  
**Actual Result:** ___

---

## TC-02: User Registration — Duplicate Email

**Requirement:** FR1 — uniqueness validation  
**Type:** Functional — API

**Input:** Same email as TC-01 (`test@leap.sl`), any password and role.

**Expected Result:**
- HTTP 409
- `success: false`
- `message` contains "already exists"

**Pass / Fail:** ___  
**Actual Result:** ___

---

## TC-03: Login — Valid Credentials

**Requirement:** FR1 (authenticate by role), NFR1  
**Type:** Functional — API

**Input:**
```json
POST /auth/login
{ "email": "student@leap.sl", "password": "Password123!" }
```

**Expected Result:**
- HTTP 200
- `success: true`
- Response contains `token`, `expires_at`, `user.roles`
- `user.roles` includes "student"

**Pass / Fail:** ___  
**Actual Result:** ___

---

## TC-04: Login — Wrong Password (Account Lock)

**Requirement:** NFR2 — account locked after 3 failed attempts (D-05)  
**Type:** Security — API

**Steps:**
1. Send `POST /auth/login` with `email: student@leap.sl`, wrong password — repeat 3 times.

**Expected Result after 3rd attempt:**
- HTTP 401 (first two attempts)
- Database: `failed_attempts = 3`, `status = 'locked'`, `locked_at` is set
- 4th attempt returns HTTP 403 with lockout message

**Pass / Fail:** ___  
**Actual Result:** ___

---

## TC-05: Auto-Unlock After 30 Minutes

**Requirement:** D-05 — automatic unlock  
**Type:** Security — Database

**Steps:**
1. Lock the account (TC-04).
2. Update `locked_at` in the database to 31 minutes ago:
   ```sql
   UPDATE users SET locked_at = DATE_SUB(NOW(), INTERVAL 31 MINUTE) WHERE email = 'student@leap.sl';
   ```
3. Attempt login with correct credentials.

**Expected Result:**
- HTTP 200 — login succeeds
- `status` reset to 'active', `failed_attempts` reset to 0
- Audit log contains `account_unlocked` with `reason: auto_unlock_30min`

**Pass / Fail:** ___  
**Actual Result:** ___

---

## TC-06: Coordinator Approves Account

**Requirement:** FR2 — coordinator approves accounts  
**Type:** Functional — API

**Prerequisites:** Log in as coordinator, obtain token. Register a pending student account.

**Input:**
```
PATCH /users/{pending_user_id}/status
Authorization: Bearer {coordinator_token}
{ "status": "active" }
```

**Expected Result:**
- HTTP 200
- Database: target user `status = 'active'`
- Notification created for the approved user
- Audit log contains `account_approved`

**Pass / Fail:** ___  
**Actual Result:** ___

---

## TC-07: Student Applies for Placement

**Requirement:** FR3 — students submit placement applications  
**Type:** Functional — API

**Prerequisites:** Student logged in, eligibility set to 'eligible', active vacancy exists.

**Input:**
```
POST /placements
Authorization: Bearer {student_token}
{ "vacancy_id": 1, "preferred_sector": "Technology" }
```

**Expected Result:**
- HTTP 201
- Database: new row in `placements` with `status = 'pending'`
- Coordinator receives a notification

**Pass / Fail:** ___  
**Actual Result:** ___

---

## TC-08: Student Applies Without Eligibility

**Requirement:** FR3 — eligibility gate  
**Type:** Functional — API (negative test)

**Prerequisites:** Student logged in but eligibility = 'not_verified'.

**Input:** Same as TC-07.

**Expected Result:**
- HTTP 403
- `message` references eligibility verification

**Pass / Fail:** ___  
**Actual Result:** ___

---

## TC-09: Coordinator Approves Placement and Letter Generated

**Requirement:** FR4 (match applications), FR5 (generate placement letter)  
**Type:** Functional — API

**Prerequisites:** Coordinator logged in, pending placement exists.

**Input:**
```
PATCH /placements/{placement_id}/status
Authorization: Bearer {coordinator_token}
{ "status": "awaiting_host" }
```

**Expected Result:**
- HTTP 200
- Placement `status = 'awaiting_host'`
- `placement_letters` table contains new letter for this placement
- Letter content includes student name and organisation name

**Pass / Fail:** ___  
**Actual Result:** ___

---

## TC-10: Host Supervisor Confirms Placement

**Requirement:** FR6 — hosts accept placement requests  
**Type:** Functional — API

**Prerequisites:** Placement in `awaiting_host` status, host supervisor assigned.

**Input:**
```
PATCH /placements/{placement_id}/status
Authorization: Bearer {host_supervisor_token}
{ "status": "confirmed" }
```

**Expected Result:**
- HTTP 200
- Placement `status = 'confirmed'`
- `host_vacancies.filled_count` incremented by 1
- Student receives notification

**Pass / Fail:** ___  
**Actual Result:** ___

---

## TC-11: Student Submits Logbook Entry

**Requirement:** FR7 — students submit validated weekly logbook entries  
**Type:** Functional — API

**Prerequisites:** Placement confirmed, student logged in.

**Input:**
```
POST /placements/{placement_id}/logbook
Authorization: Bearer {student_token}
{
  "week_number":  1,
  "entry_date":   "2027-01-10",
  "activities":   "Assisted with database design and documentation.",
  "skills_gained":"SQL, teamwork",
  "hours_worked": 40
}
```

**Expected Result:**
- HTTP 201
- Entry stored with `status = 'submitted'`
- Supervisor notified

**Pass / Fail:** ___  
**Actual Result:** ___

---

## TC-12: Duplicate Week Entry Rejected

**Requirement:** FR7 — one entry per week per placement  
**Type:** Functional — API (negative test)

**Prerequisites:** TC-11 completed.

**Input:** Same payload as TC-11 (week_number = 1).

**Expected Result:**
- HTTP 409
- `message` references duplicate week

**Pass / Fail:** ___  
**Actual Result:** ___

---

## TC-13: Entry Date Outside Placement Period Rejected

**Requirement:** FR7 — date must fall within placement period  
**Type:** Functional — API (negative test)

**Input:** Same as TC-11 but `entry_date` set to a date before placement start.

**Expected Result:**
- HTTP 422
- `message` references placement date range

**Pass / Fail:** ___  
**Actual Result:** ___

---

## TC-14: Supervisor Reviews Logbook Entry

**Requirement:** FR8 — supervisors approve or request revision  
**Type:** Functional — API

**Prerequisites:** TC-11 completed, supervisor logged in.

**Input:**
```
PATCH /logbook/{entry_id}/review
Authorization: Bearer {supervisor_token}
{ "decision": "approved" }
```

**Expected Result:**
- HTTP 200
- Entry `status = 'approved'`
- Review record in `logbook_reviews`
- Student notified

**Pass / Fail:** ___  
**Actual Result:** ___

---

## TC-15: Supervisor Requests Revision

**Requirement:** FR8 — revision_requested requires comments  
**Type:** Functional — API

**Input:**
```
PATCH /logbook/{entry_id}/review
{ "decision": "revision_requested" }
```
*(no comments field)*

**Expected Result:**
- HTTP 422 — comments are required when requesting revision

**Pass / Fail:** ___  
**Actual Result:** ___

---

## TC-16: Host Submits Evaluation

**Requirement:** FR10 — hosts submit evaluations online  
**Type:** Functional — API

**Prerequisites:** Placement active, host supervisor logged in.

**Input:**
```
POST /evaluation/{placement_id}
Authorization: Bearer {host_supervisor_token}
{
  "criteria":      { "punctuality": 4, "communication": 5, "initiative": 3 },
  "overall_score": 80,
  "comments":      "Good intern, showed initiative."
}
```

**Expected Result:**
- HTTP 201
- `host_evaluations.status = 'submitted'`
- Coordinator notified

**Pass / Fail:** ___  
**Actual Result:** ___

---

## TC-17: Grade Computation

**Requirement:** FR11 — compute final grades from weighted components  
**Type:** Functional — API

**Prerequisites:** Assessment components configured with weights summing to 100. Marks submitted for all active components.

**Input:**
```
POST /grades/{placement_id}/compute
Authorization: Bearer {coordinator_token}
```

**Expected Result:**
- HTTP 200
- `computed_score` is a decimal 0–100
- `grade_band` matches a configured band
- `breakdown` array shows each component's contribution
- `final_grades.status = 'computed'`

**Pass / Fail:** ___  
**Actual Result:** ___

---

## TC-18: Management Approves Result Before Student Can See It

**Requirement:** FR12 — management must approve before publication  
**Type:** Functional — API (access control)

**Steps:**
1. Coordinator verifies grade: `PATCH /grades/{id}/verify`
2. Student attempts to view grade: `GET /grades/{placement_id}`
3. Management approves: `PATCH /grades/{id}/approve`
4. Coordinator publishes: `PATCH /grades/{id}/publish`
5. Student attempts to view grade again.

**Expected Results:**
- Step 2: HTTP 403 — not yet published
- Step 5: HTTP 200 — grade visible with breakdown

**Pass / Fail:** ___  
**Actual Result:** ___

---

## TC-19: Role-Based Access Control

**Requirement:** NFR1, FR10  
**Type:** Security — API

**Test:** A student attempts to call a coordinator-only endpoint.

**Input:**
```
GET /users/pending
Authorization: Bearer {student_token}
```

**Expected Result:**
- HTTP 403
- `message` references insufficient role

**Pass / Fail:** ___  
**Actual Result:** ___

---

## TC-20: GPS Attendance Without Consent Rejected

**Requirement:** D-04 — consent mandatory  
**Type:** Security — API

**Input:**
```
POST /attendance
Authorization: Bearer {student_token}
{
  "placement_id":  1,
  "latitude":      8.4657,
  "longitude":     -13.2317,
  "consent_given": false
}
```

**Expected Result:**
- HTTP 403
- `message` references consent requirement
- No record created in `gps_attendance_records`

**Pass / Fail:** ___  
**Actual Result:** ___

---

## TC-21: GPS Attendance With Consent Accepted

**Requirement:** D-04 — attendance recorded with consent  
**Type:** Functional — API

**Input:** Same as TC-20 but `"consent_given": true`

**Expected Result:**
- HTTP 201
- Record in `gps_attendance_records` with `consent_given = 1`, `verified_status = 'pending'`
- Audit log entry for `attendance_recorded`
- Host supervisor notified

**Pass / Fail:** ___  
**Actual Result:** ___

---

## TC-22: SQL Injection Prevention

**Requirement:** NFR1, Security  
**Type:** Security — API

**Input:**
```json
POST /auth/login
{ "email": "' OR '1'='1", "password": "anything" }
```

**Expected Result:**
- HTTP 401 — invalid credentials (not a server error)
- No data leaked
- PDO prepared statements prevent injection

**Pass / Fail:** ___  
**Actual Result:** ___

---

## TC-23: Unauthenticated Access Rejected

**Requirement:** NFR1 — authenticated access required  
**Type:** Security — API

**Input:** `GET /placements` with no Authorization header.

**Expected Result:**
- HTTP 401
- `message` references missing token

**Pass / Fail:** ___  
**Actual Result:** ___

---

## TC-24: Database Validation — weight_percent Constraint

**Requirement:** D-02 — component weights validated  
**Type:** Database validation

**SQL:**
```sql
INSERT INTO assessment_components
  (component_name, weight_percent, is_active, created_by, created_at)
VALUES ('Bad Component', 150, 1, 1, NOW());
```

**Expected Result:**
- MySQL error — `CHECK constraint` violation (weight_percent must be 0.01–100)

**Pass / Fail:** ___  
**Actual Result:** ___

---

## TC-25: Notifications Delivered for Key Events

**Requirement:** FR13 — system sends notifications  
**Type:** Functional — API

**Steps:**
1. Coordinator approves a student account.
2. Query `GET /notifications` as the approved student.

**Expected Result:**
- HTTP 200
- At least one notification with `type = 'account_update'`
- `title` and `message` reference account approval

**Pass / Fail:** ___  
**Actual Result:** ___

---

## TC-26: Reports Access — Coordinator Only

**Requirement:** FR14 — coordinator generates reports  
**Type:** Functional + Security — API

**Test A (coordinator):** `GET /reports/placements` with coordinator token → HTTP 200  
**Test B (student):**    `GET /reports/placements` with student token → HTTP 403

**Pass / Fail (A):** ___  
**Pass / Fail (B):** ___  
**Actual Result:** ___

---

## Summary Table

| TC | Description | Req | Expected | Pass/Fail |
|---|---|---|---|---|
| TC-01 | Valid registration | FR1 | 201 pending | ___ |
| TC-02 | Duplicate email | FR1 | 409 | ___ |
| TC-03 | Valid login | FR1 | 200 + token | ___ |
| TC-04 | Account lock after 3 failures | NFR2 | 403 locked | ___ |
| TC-05 | Auto-unlock after 30 min | D-05 | 200 unlocked | ___ |
| TC-06 | Coordinator approves account | FR2 | 200 active | ___ |
| TC-07 | Student applies for placement | FR3 | 201 pending | ___ |
| TC-08 | Apply without eligibility | FR3 | 403 | ___ |
| TC-09 | Approve placement + letter | FR4, FR5 | 200 + letter | ___ |
| TC-10 | Host confirms placement | FR6 | 200 confirmed | ___ |
| TC-11 | Submit logbook entry | FR7 | 201 submitted | ___ |
| TC-12 | Duplicate week rejected | FR7 | 409 | ___ |
| TC-13 | Date outside placement period | FR7 | 422 | ___ |
| TC-14 | Supervisor approves entry | FR8 | 200 approved | ___ |
| TC-15 | Revision without comments | FR8 | 422 | ___ |
| TC-16 | Host submits evaluation | FR10 | 201 submitted | ___ |
| TC-17 | Grade computation | FR11 | 200 + score | ___ |
| TC-18 | Management gate on results | FR12 | 403 then 200 | ___ |
| TC-19 | Role-based access control | NFR1 | 403 | ___ |
| TC-20 | GPS without consent rejected | D-04 | 403 | ___ |
| TC-21 | GPS with consent accepted | D-04 | 201 | ___ |
| TC-22 | SQL injection prevention | Security | 401 no leak | ___ |
| TC-23 | Unauthenticated access | NFR1 | 401 | ___ |
| TC-24 | DB weight constraint | D-02 | MySQL error | ___ |
| TC-25 | Notification delivery | FR13 | 200 + notifs | ___ |
| TC-26 | Reports access control | FR14 | 200/403 | ___ |

---

*Instructions: Run each test case using Postman or curl. Record actual result and mark Pass or Fail. Include this completed table in the Assignment 3 submission.*

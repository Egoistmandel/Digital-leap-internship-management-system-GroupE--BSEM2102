# Demonstration Guide
## Digital LEAP Internship Management System
**Course:** COMP 217 — System Analysis and Design  
**Group:** Group E | **Semester:** 05 (September 2026 – February 2027)

---

## Quick Reference — Seed Credentials

All seed accounts use password: **Password123!**

| Role | Email | Dashboard |
|---|---|---|
| LEAP Coordinator | coordinator@leap.sl | Full admin, placements, grades |
| Student | student@leap.sl | Apply, logbook, results |
| Academic Supervisor | supervisor@leap.sl | Review logbooks, visits |
| Host Supervisor | hostsup@leap.sl | Confirm placements, evaluate |
| Management | management@leap.sl | Approve results, reports |
| Pending Student | pending@leap.sl | Shows pending approval state |

---

## Full Workflow Walkthrough

### 1 — Account Registration and Approval (FR1, FR2)

**Show:** New user cannot log in until approved.

1. Open the app → Register screen
2. Enter: Name = `Demo Student`, Email = `demo@leap.sl`, Password = `Demo1234!`, Role = Student
3. Submit → show "pending approval" confirmation screen
4. Log in as **coordinator** → Admin → Pending Approvals
5. Find `Demo Student` → tap Approve
6. Log in as `demo@leap.sl` with `Demo1234!` → now succeeds

**What this demonstrates:** FR1 (register + authenticate), FR2 (coordinator approval), NFR1 (role routing), audit log entry

---

### 2 — Placement Application (FR3, FR4, FR5, FR6)

**Show:** Full placement lifecycle from application to confirmation.

1. Log in as **student** (`student@leap.sl`)
2. Dashboard → Apply for Placement
3. Select the "Software Development Intern" vacancy at Sierra Leone Tech Hub
4. Submit → show "pending" status

5. Log in as **coordinator** (`coordinator@leap.sl`)
6. Placements menu → see the pending application
7. Tap Approve → status changes to `awaiting_host`
8. Show that a placement letter was auto-generated (FR5)

9. Log in as **host supervisor** (`hostsup@leap.sl`)
10. Dashboard → Respond to Placement Request → Accept
11. Status becomes `confirmed`; student receives notification

**What this demonstrates:** FR3, FR4, FR5, FR6, FR13 (notification)

---

### 3 — Logbook Submission and Review (FR7, FR8)

**Show:** Weekly logbook workflow with approval and revision.

1. Log in as **student**
2. Logbook → + New Entry
3. Week = 1, Date = today, Activities = "Assisted with project planning and wireframing", Hours = 8
4. Submit → status = Submitted

5. Log in as **supervisor** (`supervisor@leap.sl`)
6. Supervisor dashboard → Pending Reviews → find the entry
7. First: Request Revision with comment "Please add more detail about skills gained"
8. Log back in as student → see revision_requested status and comment
9. Submit updated entry

10. Log in as supervisor → Approve the revised entry
11. Show student sees `Approved` status

**What this demonstrates:** FR7 (validation, week number, date range), FR8 (revision loop), FR13

---

### 4 — Supervisory Visit (FR9)

**Show:** Supervisor schedules a visit and submits a report.

1. Log in as **supervisor**
2. Supervisory Visits → Schedule Visit
3. Select the student placement, set date and location
4. After "completing" the visit → Submit Visit Report
5. Show coordinator sees the visit summary notification

**What this demonstrates:** FR9

---

### 5 — Host Evaluation (FR10)

**Show:** Host supervisor evaluates intern performance.

1. Log in as **host supervisor**
2. Dashboard → Submit Intern Evaluation
3. Rate each criterion (punctuality, communication, etc.) with star ratings
4. Submit → coordinator receives notification

**What this demonstrates:** FR10

---

### 6 — Grade Computation and Publication (FR11, FR12)

**Show:** The full five-step grade pipeline.

1. Log in as **coordinator**
2. Assessment → Configure → show components and grade bands (D-02, D-03)
3. Assessment → Submit Academic Marks → select student, enter score per component
4. Assessment → Grades → find the placement → tap Compute
   - Show the breakdown: score per component, weighted total, assigned band
5. Tap Verify → status = coordinator_verified

6. Log in as **management** (`management@leap.sl`)
7. Results Approval → find the grade → tap Approve
8. Status = management_approved

9. Log in as **coordinator**
10. Grades → tap Publish → student notified

11. Log in as **student**
12. My Results → show published grade with breakdown table

**What this demonstrates:** FR11, FR12, NFR6 (audit log)

---

### 7 — GPS Attendance (D-04)

**Show:** Consent-gated location check-in.

1. Log in as **student**
2. Attendance screen → show the privacy notice displayed prominently
3. Attempt check-in WITHOUT toggling consent → show error message
4. Toggle the consent switch ON → tap Record Check-In Now
5. Show the check-in appears with `pending` verification status

6. Log in as **host supervisor** or **coordinator**
7. Verify the attendance record → status changes to `verified`
8. Student receives notification

**What this demonstrates:** D-04 (privacy, consent gate), NFR6 (audit log)

---

### 8 — Notifications (FR13)

1. Log in as **student**
2. Notifications screen → show all events that triggered notifications during the demo
3. Show unread badges on unread items
4. Tap Mark all read → badges clear

**What this demonstrates:** FR13

---

### 9 — Reports (FR14)

1. Log in as **coordinator** or **management**
2. Reports → Placement Report → show status breakdown pills and per-student table
3. Reports → Progress Report → show logbook completion bars, hours logged per student
4. Reports → Results Report → show grade distribution, average score, per-student grade table

**What this demonstrates:** FR14

---

### 10 — Security and Audit

1. Show phpMyAdmin → `audit_logs` table → rows for login, approval, grade_published events
2. Demonstrate role-based access: log in as student → try to access `/users/pending` in Postman → 403 response
3. Show `users` table → password_hash column shows `$2y$12$...` bcrypt hashes (not plaintext)

**What this demonstrates:** NFR1, NFR2, NFR6, NFR8

---

## Questions You May Be Asked — Prepared Answers

**Q: What happens if a student enters a date outside their placement period?**  
A: The backend validates the entry_date against placement start/end dates and returns a 422 error with an explanatory message. The database stores the placement dates and the application enforces the range.

**Q: How does the grade computation work?**  
A: Each active assessment component has a weight percentage. The system divides each mark by its max score, multiplies by the weight, and sums the contributions. The result is matched against the grade band configuration table to assign a letter grade. All weights and bands are configurable by the coordinator without code changes.

**Q: What if the weights don't add up to 100%?**  
A: The system detects this and normalises the weighted score, adding a warning note to the computation_notes field. The coordinator is notified and should correct the component configuration.

**Q: How is GPS attendance different from just entering a check-in time?**  
A: GPS attendance records the student's coordinates at check-in time. A supervisor can then verify whether those coordinates correspond to the host site location. However, the system explicitly notes that coordinates alone do not prove physical presence — human verification is still required. This is documented in the technical report.

**Q: What happens to data privacy for GPS?**  
A: Students must explicitly consent before any coordinates are stored. The consent_given field is enforced by both application logic and a database CHECK constraint. Coordinates are excluded from the audit log to limit precision exposure. Students see rounded coordinates. Supervisors and coordinators see full coordinates for verification purposes only.

**Q: Why are grade bands and assessment components configurable?**  
A: The official university grade boundaries (D-03) and the third assessment component name (U-01) were not confirmed at the time of implementation. Rather than hardcode values that might be wrong, the system stores them in configurable database tables that the coordinator can populate once confirmed.

**Q: What is the account lockout process?**  
A: After 3 failed login attempts, the account is locked and locked_at is recorded. The system automatically unlocks the account 30 minutes later on the next login attempt. A coordinator can also manually unlock an account via the admin panel. All lock and unlock events are written to the audit log.

---

*Document version 1.0 — prepared for COMP 217 Assignment 3, Group E, Semester 05*

# Digital LEAP Internship Management System

**Course:** COMP 217 — System Analysis and Design  
**Group:** Group E  
**Semester:** 05, September 2026 – February 2027  
**University:** Limkokwing University of Creative Technology, Sierra Leone  
**Submission Deadline:** Week 11

---

## Project Overview

A centralized digital platform that manages the full internship lifecycle at Limkokwing University — from student registration and placement through supervision, weekly logbooks, host evaluation, grade computation, management approval, and result publication.

Replaces manual paper forms, spreadsheets, and scattered emails with a secure, role-based digital system.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React Native + Expo (mobile + web) |
| Backend | PHP REST API |
| Database | MySQL |
| DB Access | PDO (prepared statements only) |
| Local Dev | XAMPP (Windows) |
| Deployment | Vercel (frontend) + PHP host (backend) |

---

## Quick Start (Local Development)

### Prerequisites
- XAMPP 8.1+ (Apache + MySQL)
- Node.js 18+ and npm

### 1 — Database
```
1. Start XAMPP (Apache + MySQL)
2. Open phpMyAdmin: http://localhost/phpmyadmin
3. Import: database/schema.sql
4. Import: database/seed_data.sql
```

### 2 — Backend
```
1. Copy backend/ → C:\xampp\htdocs\digital-leap-api\
2. Copy backend/.env.example → backend/.env
3. Edit .env: set DB_HOST, DB_NAME, DB_USER, DB_PASS
4. Enable mod_rewrite in Apache httpd.conf (AllowOverride All)
5. Test: http://localhost/digital-leap-api/auth/login
```

### 3 — Frontend
```cmd
cd frontend
npm installn
npm start
```
Press W for web browser, or scan QR code with Expo Go.

**Update BASE_URL** in `frontend/services/api.js` to your machine's local IP.


### Test Credentials (password: `Password123!`)

| Role | Email |
|---|---|
| LEAP Coordinator | coordinator@leap.sl |
| Student | student@leap.sl |
| Academic Supervisor | supervisor@leap.sl |
| Host Supervisor | hostsup@leap.sl |
| Management | management@leap.sl |

---

## Project Structure

```
project/
├── backend/                    PHP REST API
│   ├── config/                 database.php, cors.php, env.php
│   ├── controllers/            9 controllers (Auth, User, Host, Placement,
│   │                           Logbook, Visit, Assessment, Attendance, Report)
│   ├── middleware/             Auth.php (token + role guard)
│   ├── routes/                 api.php (50+ endpoints)
│   └── utils/                  Response.php, Validator.php, AuditLog.php
│
├── frontend/                   React Native + Expo
│   ├── app/                    24 screens (Expo Router)
│   │   ├── (auth)/             login, register
│   │   ├── (tabs)/             student, coordinator, supervisor, host, management
│   │   ├── admin/              approvals
│   │   ├── placements/         apply, index
│   │   ├── logbook/            index, submit
│   │   ├── assessment/         config, grades, marks
│   │   ├── evaluation/         submit
│   │   ├── results/            index
│   │   ├── attendance/         index (GPS)
│   │   ├── notifications/      index
│   │   └── reports/            placements, progress, results
│   ├── components/             Button, Card, InputField, ScreenWrapper, StatusBadge
│   ├── constants/              colors.js, roles.js
│   ├── hooks/                  useAuth.js
│   └── services/               api.js (all API calls)
│
├── database/
│   ├── schema.sql              21-table MySQL schema
│   ├── seed_data.sql           Development sample data
│   ├── data_dictionary.md      Full field-level documentation
│   ├── test_cases.md           26 documented test cases
│   └── validation_tests.sql   Database constraint verification queries
│
└── docs/
    ├── installation_guide.md   Step-by-step local + production setup
    ├── demo_guide.md           Full workflow walkthrough for presentation
    └── digital_public_goods_principles.md   DPG alignment document
```

---

## API Endpoints Summary

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | /auth/register | Register (pending approval) |
| POST | /auth/login | Login + receive token |
| POST | /auth/logout | Invalidate session |
| POST | /auth/unlock/{id} | Manual unlock (coordinator) |

### Users
| Method | Endpoint | Description |
|---|---|---|
| GET | /users/pending | List pending accounts |
| GET | /users/{id} | Get user profile |
| PUT | /users/{id} | Update own profile |
| PATCH | /users/{id}/status | Approve/suspend account |
| PATCH | /users/{id}/eligibility | Set student eligibility |

### Hosts & Placements
| Method | Endpoint | Description |
|---|---|---|
| GET/POST | /hosts | List / create organisations |
| GET | /hosts/{id} | Get org with vacancies |
| PATCH | /hosts/{id}/status | Approve/suspend |
| POST | /hosts/{id}/vacancies | Add vacancy |
| GET/POST | /placements | List / apply |
| GET | /placements/{id} | Get placement detail |
| PATCH | /placements/{id}/status | Update lifecycle status |

### Logbook & Visits
| Method | Endpoint | Description |
|---|---|---|
| GET/POST | /placements/{id}/logbook | List / submit entries |
| GET | /logbook/{id} | Get entry + reviews |
| PATCH | /logbook/{id}/review | Approve / request revision |
| GET/POST | /visits | List / schedule visit |
| POST | /visits/{id}/report | Submit visit report |

### Assessment & Grades
| Method | Endpoint | Description |
|---|---|---|
| GET/POST | /assessment/components | List / create components |
| PATCH | /assessment/components/{id} | Update component |
| POST | /assessment/marks | Submit academic marks |
| POST/GET | /evaluation/{id} | Submit / get host evaluation |
| GET | /grades/all | All grade records |
| GET/POST | /grades/config | Grade band configuration |
| GET | /grades/{id} | Get grade for placement |
| POST | /grades/{id}/compute | Compute weighted grade |
| PATCH | /grades/{id}/verify | Coordinator verify |
| PATCH | /grades/{id}/approve | Management approve |
| PATCH | /grades/{id}/publish | Publish to student |

### Attendance, Notifications, Reports
| Method | Endpoint | Description |
|---|---|---|
| POST | /attendance | Record GPS check-in (with consent) |
| GET | /attendance/{id} | List placement attendance |
| PATCH | /attendance/{id}/verify | Verify / reject record |
| GET | /notifications | List notifications |
| PATCH | /notifications/{id}/read | Mark as read |
| GET | /reports/placements | Placement summary report |
| GET | /reports/progress | Logbook + visit progress report |
| GET | /reports/results | Final grades summary report |

---

## Unresolved Items (Pending Lecturer Confirmation)

| ID | Item | Impact |
|---|---|---|
| U-01 | Third assessment component name | Add via Assessment Config screen once confirmed |
| U-02 | Assessment component default weights | Configure via Assessment Config screen |
| U-03 | Official grade band boundaries | Configure via Assessment Config screen |
| U-04 | GPS attendance validation workflow detail | Privacy policy confirmed; validation logic ready |
| U-05 | Faculty Coordinator vs Faculty Mentor exact permissions | Assumption A-01 documented in Milestone 1 |

---

## Functional Requirements Coverage

| FR | Description | Status |
|---|---|---|
| FR1 | Register and authenticate users by role | ✅ Implemented |
| FR2 | Coordinator approves accounts | ✅ Implemented |
| FR3 | Students submit placement applications | ✅ Implemented |
| FR4 | Coordinator matches applications to vacancies | ✅ Implemented |
| FR5 | System generates placement letters | ✅ Implemented |
| FR6 | Hosts accept or decline placement requests | ✅ Implemented |
| FR7 | Students submit validated weekly logbook entries | ✅ Implemented |
| FR8 | Supervisors approve entries or request revisions | ✅ Implemented |
| FR9 | Supervisors schedule visits and record reports | ✅ Implemented |
| FR10 | Hosts submit evaluations online | ✅ Implemented |
| FR11 | System computes final grades (configurable weights) | ✅ Implemented |
| FR12 | Management approves results before publication | ✅ Implemented |
| FR13 | System sends notifications for key events | ✅ Implemented |
| FR14 | Coordinator and Management generate reports | ✅ Implemented |

---

## Milestone Progress

- [x] M0 — Documentation audit and requirements analysis
- [x] M1 — System architecture and database design (21 tables, ERD, data dictionary)
- [x] M2 — Backend foundation (auth, roles, audit log, PDO, CORS)
- [x] M3 — Frontend foundation (navigation, auth screens, all 5 role dashboards)
- [x] M4 — Core internship workflows (users, hosts, placements, logbooks, visits)
- [x] M5 — Assessment and results (evaluation, marks, grade computation, approval, publication)
- [x] M6 — GPS attendance with consent flow and privacy protection
- [x] M7 — Notifications, reports (placements, progress, results), data dictionary, 26 test cases
- [x] M8 — Testing: DB validation scripts, API test cases, QA documentation
- [x] M9 — Deployment: Vercel config, .env loader, installation guide, demo guide, DPG document

---

## Documentation Index

| Document | Location | Purpose |
|---|---|---|
| Data Dictionary | database/data_dictionary.md | All 21 tables, fields, types, constraints |
| Test Cases | database/test_cases.md | 26 API + DB + security test cases |
| Validation Tests | database/validation_tests.sql | Automated DB constraint queries |
| Installation Guide | docs/installation_guide.md | Local + production setup |
| Demo Guide | docs/demo_guide.md | Full workflow walkthrough + Q&A |
| DPG Principles | docs/digital_public_goods_principles.md | Open standards, privacy, accessibility, SDGs |

---

## Academic Integrity

This project was developed by Group E for COMP 217 at Limkokwing University of Creative Technology, Sierra Leone, Semester 05 (September 2026 – February 2027). It builds directly on the requirements and models from Assignments 1 and 2.

Please adhere to the university's academic integrity and plagiarism policies.

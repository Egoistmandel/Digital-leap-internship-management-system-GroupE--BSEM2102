# Digital Public Goods Principles
## Digital LEAP Internship Management System
**Course:** COMP 217 — System Analysis and Design  
**Group:** Group E | **Semester:** 05 (September 2026 – February 2027)

---

The [Digital Public Goods Alliance](https://digitalpublicgoods.net/) defines Digital Public Goods as open-source software, open data, open AI models, open standards, and open content that adhere to privacy and other applicable laws and best practices, do no harm, and help attain the Sustainable Development Goals (SDGs).

The table below documents how the Digital LEAP Internship Management System applies each DPG principle.

---

## 1. Open Licensing

| Aspect | Implementation |
|---|---|
| Frontend | React Native and Expo are MIT-licensed. All project-specific code is authored by Group E. |
| Backend | PHP is a permissive open-source language. No commercial framework dependencies. |
| Database | MySQL Community Edition is GPL-licensed and freely available. |
| Project code | No proprietary third-party libraries have been introduced beyond what Expo provides. |

**Recommendation for submission:** If the university requires an open licence on student project code, attach an MIT or Apache 2.0 licence file to the repository before submission.

---

## 2. Open Standards

| Standard | Where Used |
|---|---|
| REST (HTTP/JSON) | All frontend-to-backend communication uses standard HTTP methods (GET, POST, PATCH, DELETE) and JSON response bodies. No proprietary API format is used. |
| UTF-8 / UTF-8MB4 | All database tables and API responses use UTF-8MB4 encoding, supporting Sierra Leonean names and Unicode characters. |
| ISO 8601 dates | All date fields (DATE, DATETIME) follow the ISO 8601 standard (YYYY-MM-DD, YYYY-MM-DDTHH:MM:SS). |
| bcrypt | Password hashing uses the bcrypt algorithm — an open and widely adopted standard. |
| Bearer token auth | Authentication uses HTTP Authorization: Bearer headers, a standard defined in RFC 6750. |

---

## 3. Interoperability

| Aspect | Implementation |
|---|---|
| REST API | The PHP backend exposes a documented REST API. Any client that can make HTTP requests (mobile app, web browser, another system) can integrate with it. |
| JSON data format | All API responses use JSON — the most widely supported data interchange format. |
| Expo web export | The React Native frontend exports to a standard web bundle deployable on any static hosting provider. |
| Database portability | The MySQL schema uses standard SQL that is compatible with MariaDB and other MySQL-compatible databases. |
| No lock-in | No proprietary cloud provider SDKs (Firebase, AWS Amplify, Supabase) are used in the core system. |

---

## 4. Reusability

| Aspect | Implementation |
|---|---|
| Reusable components | The frontend includes five reusable components (Button, Card, InputField, ScreenWrapper, StatusBadge) used across all screens. |
| Reusable utilities | The backend provides shared utilities (Response, Validator, AuditLog) used by all controllers. |
| Configurable assessment | Assessment components, weights, and grade bands are stored in the database and configurable without code changes (D-02, D-03). |
| Role-based architecture | The role and permission system can be extended to new roles without structural changes. |
| Documentation | The data dictionary, API route map, and installation guide provide sufficient documentation for another developer to understand and extend the system. |

---

## 5. Accessibility

| Aspect | Implementation |
|---|---|
| Screen reader labels | All interactive elements (buttons, inputs, touchables) include `accessibilityLabel` and `accessibilityRole` props. |
| Minimum touch target | All buttons have a `minHeight: 48` style, meeting the WCAG 2.1 AA minimum touch target size. |
| Colour contrast | The colour palette uses dark text on light backgrounds and light text on the primary blue, maintaining readable contrast ratios. |
| Error messaging | Validation errors are displayed as inline text with `accessibilityRole="alert"`, not hidden behind colours alone. |
| Keyboard avoidance | Login and registration screens use `KeyboardAvoidingView` to prevent the keyboard covering input fields on mobile. |
| Mobile-first | The interface is designed for mobile screens first (NFR4), consistent with student device access in Sierra Leone. |

**Note:** Full WCAG 2.1 compliance requires manual testing with assistive technologies such as TalkBack (Android) and VoiceOver (iOS). The accessibility attributes applied provide a foundation but are not a substitute for professional accessibility audit.

---

## 6. Privacy

| Aspect | Implementation |
|---|---|
| Minimal data collection | Only data required for internship administration is collected. No social profiles, unnecessary personal details, or tracking data is stored. |
| GPS consent gate | GPS location data cannot be recorded without explicit student consent (D-04). The database enforces `consent_given = 1` via CHECK constraint. |
| Coordinate precision | Student-facing views return GPS coordinates rounded to 2 decimal places to reduce precision exposure. |
| Coordinates excluded from audit log | Precise GPS coordinates are deliberately excluded from audit log details. |
| Password security | Passwords are hashed with bcrypt (cost 12). Plaintext passwords are never stored, logged, or returned in API responses. |
| Role-based data access | Each role can only access data relevant to their responsibilities. Students cannot see other students' records. |
| Audit log | All sensitive actions (grade changes, account approvals, lock/unlock events) are recorded with user, time, and action details (NFR-06). |

---

## 7. Security

| Aspect | Implementation |
|---|---|
| Authentication | Bearer token authentication on all protected endpoints. Tokens are generated using `random_bytes(32)` (cryptographically secure). |
| Authorisation | Role-based access control enforced on every endpoint via `Auth::requireRole()`. |
| Input validation | Server-side validation on all API inputs using the `Validator` utility. Client-side validation provides UX feedback only. |
| SQL injection prevention | All database queries use PDO prepared statements with parameterised values. No string interpolation in SQL. |
| Account lockout | Accounts lock after 3 failed login attempts with 30-minute auto-unlock (D-05, NFR-02). |
| CORS | Cross-origin requests restricted to approved frontend origins in `cors.php`. |
| Security headers | `.htaccess` and `vercel.json` add X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, and Referrer-Policy headers. |
| HTTPS | Production deployment requires HTTPS. The API and frontend must be served over TLS. |
| Error handling | Server errors return generic messages to clients. Detailed error information is written to the server error log only. |

---

## 8. Documentation

| Document | Location | Purpose |
|---|---|---|
| README.md | Project root | Overview, setup, API endpoints, test credentials |
| Data Dictionary | database/data_dictionary.md | Full field-level documentation for all 21 tables |
| Test Cases | database/test_cases.md | 26 documented test cases with inputs and expected results |
| Validation Tests | database/validation_tests.sql | Automated database constraint verification queries |
| Installation Guide | docs/installation_guide.md | Step-by-step local and production setup |
| DPG Principles | docs/digital_public_goods_principles.md | This document |
| API route map | backend/routes/api.php | All endpoints documented inline with comments |
| In-code comments | All PHP and JS files | Business rules, security notes, unresolved items |

---

## 9. Sustainability

| Aspect | Implementation |
|---|---|
| Technology choices | PHP, MySQL, React Native, and Expo are all mature, widely supported technologies with large communities and long-term viability. |
| No vendor lock-in | The system can be hosted on any PHP-compatible web host and any MySQL-compatible database provider. |
| Maintainability | Code is separated into controllers, utilities, and components with clear responsibilities. Configuration is separated from business logic. |
| Configurability | Assessment components, grade bands, and notification messages are configurable without code changes — reducing the need for developer intervention for routine academic year updates. |
| Local deployment | The system can run entirely on XAMPP for demonstration without requiring internet access — important for areas with unreliable connectivity in Sierra Leone. |

---

## Alignment with UN Sustainable Development Goals

| SDG | Relevance |
|---|---|
| SDG 4 — Quality Education | The system directly supports higher education by improving the quality and efficiency of internship programme management at a Sierra Leonean university. |
| SDG 8 — Decent Work and Economic Growth | The LEAP platform connects students with industry host organisations, supporting skill development and professional readiness. |
| SDG 9 — Industry, Innovation and Infrastructure | The system replaces manual paper-based processes with a digital platform, contributing to institutional digital infrastructure. |
| SDG 17 — Partnerships for the Goals | The internship workflow formalises and strengthens partnerships between the university and host organisations. |

---

*Document version 1.0 — prepared for COMP 217 Assignment 3, Group E, Semester 05*

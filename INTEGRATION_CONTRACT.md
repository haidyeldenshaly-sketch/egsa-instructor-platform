# INTEGRATION CONTRACT — Instructor Project ⇄ Student Project

**Status:** the Instructor Project is standalone. The integration endpoints below exist and are tested **inside this project only**; nothing here calls the Student Project, and nothing requires it to be running. This document is the contract the Student Project (and a future Admin system) will code against.

## 1. Principles
1. Each project owns its database. No shared collections, no cross-project DB access.
2. Projects exchange **stable string identifiers** over HTTPS JSON. Each side stores the other's id.
3. The Instructor Project is the **source of truth** for: sessions, attendance, assessments (instructor side), grading and result publication.
4. The Student Project is the **source of truth** for: students, applications, payments, enrollments, and submission content.
5. Student-facing reads only ever return **published** assessments and **published** results. Drafts and unpublished evaluations never leave this project.
6. No payment/credential data ever crosses this boundary.

## 2. Authentication expectations
| Direction | Mechanism today | Notes |
|---|---|---|
| Instructor (human) → Instructor API | JWT access (15 min) + rotating refresh token, role `instructor` | Standalone accounts. If SSO with the main platform is desired later, replace `/auth/login` with token exchange; the `User.role` claim must stay `instructor`. |
| Student Project (server) → Instructor API | `x-api-key: <INTEGRATION_API_KEY>` on `/api/v1/integration/*` | Server-to-server only; never expose the key to browsers. Rotate via env var. Recommended upgrade before production: signed service JWT or mTLS + IP allow-list. |
| Student (human) | **Never** authenticates against this project | Students use the Student Project; it proxies/relays what they may see. |

## 3. Identifier contract
| Concept | Owner | Field here | Format | Notes |
|---|---|---|---|---|
| Student ID | Student Project | `StudentReference.externalStudentId` | string (any stable, e.g. `stu-dev-001`) | Unique. Required on every integration call. |
| Course ID | Student Project / Admin | `Course.externalCourseId` | string | Our `Course._id` is a 24-hex ObjectId. |
| Cohort ID | Student Project / Admin | `Cohort.externalCohortId` | string | Integration calls accept `cohortId` (ours) **or** `externalCohortId`. |
| Enrollment ID | Student Project | `EnrollmentReference.externalEnrollmentId` | string | Unique per (student, cohort). |
| Session ID | **Instructor Project** | `Session._id` (+ optional `externalSessionId`) | 24-hex ObjectId | Student Project stores ours when it syncs sessions. |
| Assessment ID | **Instructor Project** | `Assessment._id` (+ optional `externalAssessmentId`) | 24-hex ObjectId | Returned by `GET /integration/assessments`; the Student Project must send it back on submit. |
| Submission ID | Student Project (optional) / Instructor | `externalSubmissionId` / `AssessmentSubmission._id` | string / ObjectId | Our id is returned from the submit call. |
| Instructor ID | Instructor Project | `User._id` | ObjectId | Never trusted from clients; derived from JWT. |

## 4. Implemented integration endpoints (all require `x-api-key`)
Base: `/api/v1/integration`. Full request/response detail: `API_REFERENCE.md`.

### 4.1 Enrollment sync — `POST /enrollments`
Student Project calls this after payment/enrollment (and again with `status` to withdraw/complete).
```json
{ "externalStudentId": "stu-123", "name": "Student Name", "email": "student@example.com",
  "cohortId": "<our cohort _id>"            /* or */ , "externalCohortId": "coh-ssf-01",
  "externalEnrollmentId": "enr-456", "status": "active | completed | withdrawn" }
```
→ `201 { studentId, enrollmentId, cohortId }`. Idempotent (upsert by student+cohort). Only `name` and `email` are stored for the student.

### 4.2 Assessment discovery — `GET /assessments?cohortId=…|externalCohortId=…`
Returns **published only**: `{ _id, title, description, instructions, startDate, dueDate, attachments[], gradingConfig{maxScore|null}, publishedAt, cohort, course }`.

### 4.3 Submission intake — `POST /submissions`
```json
{ "assessmentId": "<our assessment _id>", "externalStudentId": "stu-123",
  "content": "text", "attachments": [{ "name": "report.pdf", "url": "https://…" }],
  "externalSubmissionId": "sub-789", "submittedAt": "2026-10-09T10:00:00Z" }
```
→ `201 { submissionId, status: "submitted" }`. Rules enforced here: assessment must be **published**; student must be **actively enrolled** in the assessment's cohort; **one submission per student per assessment** (409 on duplicate). The cohort's instructor receives a `new_submission` notification. *Late-submission policy is undefined (see §7); late submissions are recorded, not rejected.*

### 4.4 Published results — `GET /results?externalStudentId=…[&assessmentId=…]`
Returns **published only**: `[{ submission, assessment, score, feedback, strengths, improvements, publishedAt }]`. Results that are saved but not published are never returned.

### 4.5 Attendance — `GET /attendance?externalStudentId=…[&cohortId=…]`
`[{ session, status: "present|absent|pending", markedAt }]`.

### 4.6 Student-Instructor Private Messaging — `/api/v1/integration/students/:studentId/conversations*`
Used by the Student Portal to relay student messages to their cohort instructor. Requires `x-api-key: <INTEGRATION_API_KEY>`.
- `GET /students/:studentId/conversations`: Returns all active conversations between the student and their authorized instructors (`{ data: [Conversation] }`).
- `GET /students/:studentId/conversations/:conversationId/messages`: Returns message thread (`{ data: [Message], meta: { total, unreadCount } }`). Automatically marks instructor messages as read by the student.
- `POST /students/:studentId/conversations/:conversationId/messages`: Sends student message (`{ body: "..." }`). Updates conversation `lastMessage`, increments `unreadCountInstructor`, and triggers an instructor notification (`new_message`).

## 5. Payload shapes
**Attendance record**
```json
{ "session": "<sessionId>", "status": "present", "markedAt": "2026-10-09T09:15:00.000Z" }
```
**Assessment result (published)**
```json
{ "submission": "<submissionId>", "assessment": "<assessmentId>", "score": 42, "feedback": "…", "strengths": "…", "improvements": "…", "publishedAt": "…" }
```
No pass mark, percentage or grade band is transmitted — none is defined. `gradingConfig.maxScore` is sent only when the instructor configured one.

**Notification (instructor-side, produced here)**
```json
{ "type": "new_submission | assessment_deadline | upcoming_session | new_assignment | system", "title": "…", "message": "…", "link": "/instructor/…", "createdAt": "…" }
```
Types `new_submission` (on intake), `upcoming_session` (≤24 h) and `assessment_deadline` (≤48 h) are generated automatically and de-duplicated.

## 6. Endpoints REQUIRED LATER (not implemented — flagged, not faked)
| Needed | Why | Suggested shape |
|---|---|---|
| Course / cohort / instructor-assignment sync from Admin | Courses, cohorts and the `Cohort.instructor` assignment are currently created by seed data only; the Admin system owns them | `POST/PUT /integration/courses`, `/integration/cohorts` (upsert by external id; assignment = instructor user id) |
| Instructor account provisioning | No Admin UI here | `POST /integration/instructors` or SSO |
| Session feed for students | Students must see session schedule | `GET /integration/sessions?cohortId=` (published/scheduled only) |
| Result-published webhook | Avoid polling | Instructor → Student: `POST <student-project>/hooks/result-published { externalStudentId, assessmentId, submissionId }` |
| Completion / evaluation read | Certificate flow is Admin/Student-owned | Read-only `GET /integration/completion-status` (attendance + assessment statuses); **the Instructor Project must never issue certificates** |

## 7. Business rules NOT defined (deliberately not invented)
- Attendance threshold / minimum percentage for completion.
- Passing score, grading scale, grade bands, weighting of assessments.
- Late-submission policy (accept/penalise/reject).
- Whether a published result may be corrected (currently: **locked once published**; a correction workflow needs a decision).
- Official overall "progress %" formula (underlying metrics are shown instead).
- Instructor permission to correct attendance after a session is completed (currently allowed, activity-logged, not time-limited).

# API Reference — EGSA Instructor Project

Base URL: `{{baseUrl}}/api/v1` (dev: `http://localhost:5100/api/v1`). Generated from `docs/endpoints.js`, the same source as the Postman collection; every endpoint listed exists and is covered by `npm test` and/or the Postman run.

## Conventions
- Success envelope: `{ "success": true, "data": …, "meta"?: … }`. Error envelope: `{ "success": false, "error": { "message": "…", "details"?: [{ "field", "message" }] } }`.
- **Auth** — `JWT`: `Authorization: Bearer <accessToken>` (15 min). `API key`: `x-api-key` header, used only by the future Student-Project integration endpoints.
- **Authorization** — every `/instructor/*` route requires role `instructor`; the instructor identity is ALWAYS taken from the JWT (never from body/params/query). Every cohort/session/assessment/submission/student is resolved through the cohort assignment (`Cohort.instructor`). A resource that is missing **or** belongs to another instructor returns **404** (existence is not leaked).
- Malformed ids → 400/404, never 500. Unknown routes → 404 JSON. Server errors never leak internals.


## Auth

### Login

`POST /api/v1/auth/login`

| | |
|---|---|
| Authentication | none |
| Role | any active user |
| Success status | 200 |

**Request body**
```json
{
  "email": "{{instructorEmail}}",
  "password": "{{instructorPassword}}"
}
```

**Response** — { accessToken, refreshToken, user }  (user never includes password/refresh hashes)

**Errors**
- `400` Validation failed
- `401` Invalid email or password (same message for unknown email)
- `403` Account not active
- `429` Rate limited (30 / 15 min per IP)

**Example**
```bash
curl -X POST "$BASE/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"{{instructorEmail}}","password":"{{instructorPassword}}"}'
```

### Get current user

`GET /api/v1/auth/me`

| | |
|---|---|
| Authentication | JWT (Bearer access token) |
| Role | any authenticated |
| Success status | 200 |

**Response** — User (safe fields)

**Errors**
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)

**Example**
```bash
curl -X GET "$BASE/api/v1/auth/me" \
  -H "Authorization: Bearer $TOKEN"
```

### Forgot password

`POST /api/v1/auth/forgot-password`

| | |
|---|---|
| Authentication | none |
| Role | - |
| Success status | 200 |

**Request body**
```json
{
  "email": "{{instructorEmail}}"
}
```

**Response** — { message } — identical whether or not the account exists

**Errors**
- `400` Validation failed

**Example**
```bash
curl -X POST "$BASE/api/v1/auth/forgot-password" \
  -H "Content-Type: application/json" \
  -d '{"email":"{{instructorEmail}}"}'
```

### Reset password

`POST /api/v1/auth/reset-password`

| | |
|---|---|
| Authentication | none |
| Role | - |
| Success status | 400 |

**Request body**
```json
{
  "token": "<token from email>",
  "password": "NewPassw0rd"
}
```

**Response** — { message }

**Errors**
- `400` Invalid/expired/used token or weak password

**Example**
```bash
curl -X POST "$BASE/api/v1/auth/reset-password" \
  -H "Content-Type: application/json" \
  -d '{"token":"<token from email>","password":"NewPassw0rd"}'
```

### Refresh tokens

`POST /api/v1/auth/refresh`

| | |
|---|---|
| Authentication | none |
| Role | - |
| Success status | 200 |

**Request body**
```json
{
  "refreshToken": "{{refreshToken}}"
}
```

**Response** — { accessToken, refreshToken, user } — the presented refresh token is rotated (single use); other devices stay signed in

**Errors**
- `401` Invalid/used refresh token

**Example**
```bash
curl -X POST "$BASE/api/v1/auth/refresh" \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"{{refreshToken}}"}'
```

### Logout (this session)

`POST /api/v1/auth/logout`

| | |
|---|---|
| Authentication | JWT (Bearer access token) |
| Role | any authenticated |
| Success status | 200 |

**Request body**
```json
{
  "refreshToken": "{{refreshToken}}"
}
```

**Response** — { loggedOut: true }

**Errors**
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)

**Example**
```bash
curl -X POST "$BASE/api/v1/auth/logout" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"{{refreshToken}}"}'
```

## Dashboard

### Dashboard

`GET /api/v1/instructor/dashboard`

| | |
|---|---|
| Authentication | JWT (Bearer access token) |
| Role | instructor |
| Success status | 200 |

**Response** — { stats{assignedCourses,activeCohorts,totalCohorts,students,upcomingSessions,pendingGrading,unreadNotifications}, upcomingSessions[], pendingSubmissions[], recentAttendance[], recentActivity[] } — every value computed from the DB

**Errors**
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)

**Example**
```bash
curl -X GET "$BASE/api/v1/instructor/dashboard" \
  -H "Authorization: Bearer $TOKEN"
```

## Courses

### List my courses

`GET /api/v1/instructor/courses`

| | |
|---|---|
| Authentication | JWT (Bearer access token) |
| Role | instructor |
| Success status | 200 |

**Response** — Course[] each with assignedCohorts[]; only courses of cohorts assigned to me

**Errors**
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)

**Example**
```bash
curl -X GET "$BASE/api/v1/instructor/courses" \
  -H "Authorization: Bearer $TOKEN"
```

### Get course

`GET /api/v1/instructor/courses/{{courseId}}`

| | |
|---|---|
| Authentication | JWT (Bearer access token) |
| Role | instructor |
| Success status | 200 |

**Response** — Course + assignedCohorts[] (with enrolledCount, sessionsCount)

**Errors**
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)

**Example**
```bash
curl -X GET "$BASE/api/v1/instructor/courses/<courseId>" \
  -H "Authorization: Bearer $TOKEN"
```

## Cohorts

### List my cohorts

`GET /api/v1/instructor/cohorts`

| | |
|---|---|
| Authentication | JWT (Bearer access token) |
| Role | instructor |
| Query | `status`, `courseId` |
| Success status | 200 |

**Response** — Cohort[] with course, enrolledCount, sessionsCount, nextSession

**Errors**
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)

**Example**
```bash
curl -X GET "$BASE/api/v1/instructor/cohorts" \
  -H "Authorization: Bearer $TOKEN"
```

### Get cohort (overview)

`GET /api/v1/instructor/cohorts/{{cohortId}}`

| | |
|---|---|
| Authentication | JWT (Bearer access token) |
| Role | instructor |
| Success status | 200 |

**Response** — Cohort + course, instructor, enrolledCount, sessionsCount, assessmentsCount

**Errors**
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)

**Example**
```bash
curl -X GET "$BASE/api/v1/instructor/cohorts/<cohortId>" \
  -H "Authorization: Bearer $TOKEN"
```

### Cohort students

`GET /api/v1/instructor/cohorts/{{cohortId}}/students`

| | |
|---|---|
| Authentication | JWT (Bearer access token) |
| Role | instructor |
| Success status | 200 |

**Response** — Student progress rows

**Errors**
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)

**Example**
```bash
curl -X GET "$BASE/api/v1/instructor/cohorts/<cohortId>/students" \
  -H "Authorization: Bearer $TOKEN"
```

### Cohort sessions

`GET /api/v1/instructor/cohorts/{{cohortId}}/sessions`

| | |
|---|---|
| Authentication | JWT (Bearer access token) |
| Role | instructor |
| Success status | 200 |

**Response** — Session[] (+meta)

**Errors**
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)

**Example**
```bash
curl -X GET "$BASE/api/v1/instructor/cohorts/<cohortId>/sessions" \
  -H "Authorization: Bearer $TOKEN"
```

### Cohort attendance summary

`GET /api/v1/instructor/cohorts/{{cohortId}}/attendance`

| | |
|---|---|
| Authentication | JWT (Bearer access token) |
| Role | instructor |
| Success status | 200 |

**Response** — Per student { totalSessions, present, absent, pending, attendancePercentage|null }

**Errors**
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)

**Example**
```bash
curl -X GET "$BASE/api/v1/instructor/cohorts/<cohortId>/attendance" \
  -H "Authorization: Bearer $TOKEN"
```

### Cohort assessments

`GET /api/v1/instructor/cohorts/{{cohortId}}/assessments`

| | |
|---|---|
| Authentication | JWT (Bearer access token) |
| Role | instructor |
| Success status | 200 |

**Response** — Assessment[] with submission counts

**Errors**
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)

**Example**
```bash
curl -X GET "$BASE/api/v1/instructor/cohorts/<cohortId>/assessments" \
  -H "Authorization: Bearer $TOKEN"
```

### Cohort progress

`GET /api/v1/instructor/cohorts/{{cohortId}}/progress`

| | |
|---|---|
| Authentication | JWT (Bearer access token) |
| Role | instructor |
| Success status | 200 |

**Response** — Per student metrics (attendance + assessments); no invented overall %

**Errors**
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)

**Example**
```bash
curl -X GET "$BASE/api/v1/instructor/cohorts/<cohortId>/progress" \
  -H "Authorization: Bearer $TOKEN"
```

## Sessions

### List sessions

`GET /api/v1/instructor/sessions`

| | |
|---|---|
| Authentication | JWT (Bearer access token) |
| Role | instructor |
| Query | `cohortId`, `status`, `upcoming`, `page`, `limit` |
| Success status | 200 |

**Response** — Session[] + meta{page,limit,total}

**Errors**
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)

**Example**
```bash
curl -X GET "$BASE/api/v1/instructor/sessions" \
  -H "Authorization: Bearer $TOKEN"
```

### Create session

`POST /api/v1/instructor/sessions`

| | |
|---|---|
| Authentication | JWT (Bearer access token) |
| Role | instructor |
| Success status | 201 |

**Request body**
```json
{
  "cohortId": "{{cohortId}}",
  "title": "Postman Lab Session",
  "description": "Created from Postman",
  "date": "2026-12-15",
  "startTime": "09:00",
  "endTime": "11:00",
  "location": "Lab 2"
}
```

**Response** — Session

**Errors**
- `400` Validation (e.g. endTime <= startTime)
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)

**Example**
```bash
curl -X POST "$BASE/api/v1/instructor/sessions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cohortId":"{{cohortId}}","title":"Postman Lab Session","description":"Created from Postman","date":"2026-12-15","startTime":"09:00","endTime":"11:00","location":"Lab 2"}'
```

### Get session

`GET /api/v1/instructor/sessions/{{sessionId}}`

| | |
|---|---|
| Authentication | JWT (Bearer access token) |
| Role | instructor |
| Success status | 200 |

**Response** — Session + attendanceSummary{present,absent,pending}

**Errors**
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)

**Example**
```bash
curl -X GET "$BASE/api/v1/instructor/sessions/<sessionId>" \
  -H "Authorization: Bearer $TOKEN"
```

### Update / cancel session

`PATCH /api/v1/instructor/sessions/{{newSessionId}}`

| | |
|---|---|
| Authentication | JWT (Bearer access token) |
| Role | instructor |
| Success status | 200 |

**Request body**
```json
{
  "title": "Postman Lab Session (updated)"
}
```

**Response** — Session

**Errors**
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)
- `409` Session is cancelled

**Example**
```bash
curl -X PATCH "$BASE/api/v1/instructor/sessions/<newSessionId>" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Postman Lab Session (updated)"}'
```

## Students

### List my students

`GET /api/v1/instructor/students`

| | |
|---|---|
| Authentication | JWT (Bearer access token) |
| Role | instructor |
| Query | `cohortId`, `search` |
| Success status | 200 |

**Response** — One row per enrollment: { student, cohort, course, attendance{}, assessments{}, trainingStatus }

**Errors**
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)

**Example**
```bash
curl -X GET "$BASE/api/v1/instructor/students" \
  -H "Authorization: Bearer $TOKEN"
```

### Student training profile

`GET /api/v1/instructor/students/{{studentId}}`

| | |
|---|---|
| Authentication | JWT (Bearer access token) |
| Role | instructor |
| Success status | 200 |

**Response** — { student{name,email,externalStudentId}, progress[], attendanceRecords[], submissions[] } — academic data only

**Errors**
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)

**Example**
```bash
curl -X GET "$BASE/api/v1/instructor/students/<studentId>" \
  -H "Authorization: Bearer $TOKEN"
```

## Attendance

### Session roster

`GET /api/v1/instructor/attendance/sessions/{{sessionId}}`

| | |
|---|---|
| Authentication | JWT (Bearer access token) |
| Role | instructor |
| Success status | 200 |

**Response** — { session, roster:[{ student, status: present|absent|pending, markedAt }] }

**Errors**
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)

**Example**
```bash
curl -X GET "$BASE/api/v1/instructor/attendance/sessions/<sessionId>" \
  -H "Authorization: Bearer $TOKEN"
```

### Save attendance

`PUT /api/v1/instructor/attendance/sessions/{{sessionId}}`

| | |
|---|---|
| Authentication | JWT (Bearer access token) |
| Role | instructor |
| Success status | 200 |

**Request body**
```json
{
  "records": [
    {
      "studentId": "{{studentId}}",
      "status": "present"
    }
  ]
}
```

**Response** — Updated roster

**Errors**
- `400` Invalid status
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)
- `409` Session cancelled
- `422` A student is not actively enrolled in the cohort

**Example**
```bash
curl -X PUT "$BASE/api/v1/instructor/attendance/sessions/<sessionId>" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"records":[{"studentId":"{{studentId}}","status":"present"}]}'
```

### Cohort attendance records

`GET /api/v1/instructor/attendance/cohorts/{{cohortId}}`

| | |
|---|---|
| Authentication | JWT (Bearer access token) |
| Role | instructor |
| Success status | 200 |

**Response** — Per student totals + attendancePercentage (present ÷ recorded; null when nothing recorded). No threshold applied.

**Errors**
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)

**Example**
```bash
curl -X GET "$BASE/api/v1/instructor/attendance/cohorts/<cohortId>" \
  -H "Authorization: Bearer $TOKEN"
```

## Assessments

### Create assessment (draft)

`POST /api/v1/instructor/assessments`

| | |
|---|---|
| Authentication | JWT (Bearer access token) |
| Role | instructor |
| Success status | 201 |

**Request body**
```json
{
  "cohortId": "{{cohortId}}",
  "title": "Postman Assessment",
  "description": "Created via Postman",
  "instructions": "Answer briefly.",
  "startDate": "2026-11-01",
  "dueDate": "2026-12-30",
  "gradingConfig": {
    "maxScore": 50
  }
}
```

**Response** — Assessment (status ALWAYS draft)

**Errors**
- `400` Validation failed
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)

**Example**
```bash
curl -X POST "$BASE/api/v1/instructor/assessments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cohortId":"{{cohortId}}","title":"Postman Assessment","description":"Created via Postman","instructions":"Answer briefly.","startDate":"2026-11-01","dueDate":"2026-12-30","gradingConfig":{"maxScore":50}}'
```

### List assessments

`GET /api/v1/instructor/assessments`

| | |
|---|---|
| Authentication | JWT (Bearer access token) |
| Role | instructor |
| Query | `cohortId`, `status` |
| Success status | 200 |

**Response** — Assessment[] with submissions counts

**Errors**
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)

**Example**
```bash
curl -X GET "$BASE/api/v1/instructor/assessments" \
  -H "Authorization: Bearer $TOKEN"
```

### Get assessment

`GET /api/v1/instructor/assessments/{{assessmentId}}`

| | |
|---|---|
| Authentication | JWT (Bearer access token) |
| Role | instructor |
| Success status | 200 |

**Response** — Assessment + submissions{submitted,pendingGrading,evaluated,resultsPublished}

**Errors**
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)

**Example**
```bash
curl -X GET "$BASE/api/v1/instructor/assessments/<assessmentId>" \
  -H "Authorization: Bearer $TOKEN"
```

### Edit draft assessment

`PATCH /api/v1/instructor/assessments/{{assessmentId}}`

| | |
|---|---|
| Authentication | JWT (Bearer access token) |
| Role | instructor |
| Success status | 200 |

**Request body**
```json
{
  "title": "Postman Assessment v2"
}
```

**Response** — Assessment

**Errors**
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)
- `409` Only draft assessments can be edited

**Example**
```bash
curl -X PATCH "$BASE/api/v1/instructor/assessments/<assessmentId>" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Postman Assessment v2"}'
```

### Publish assessment

`POST /api/v1/instructor/assessments/{{assessmentId}}/publish`

| | |
|---|---|
| Authentication | JWT (Bearer access token) |
| Role | instructor |
| Success status | 200 |

**Response** — Assessment (status published)

**Errors**
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)
- `409` Already published
- `422` Missing description/instructions

**Example**
```bash
curl -X POST "$BASE/api/v1/instructor/assessments/<assessmentId>/publish" \
  -H "Authorization: Bearer $TOKEN"
```

### Create throwaway draft

`POST /api/v1/instructor/assessments`

| | |
|---|---|
| Authentication | JWT (Bearer access token) |
| Role | instructor |
| Success status | 201 |

**Request body**
```json
{
  "cohortId": "{{cohortId}}",
  "title": "Throwaway draft",
  "description": "to be deleted"
}
```

**Response** — Assessment (draft)

**Errors**
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)

**Example**
```bash
curl -X POST "$BASE/api/v1/instructor/assessments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cohortId":"{{cohortId}}","title":"Throwaway draft","description":"to be deleted"}'
```

### Delete draft assessment

`DELETE /api/v1/instructor/assessments/{{draftId}}`

| | |
|---|---|
| Authentication | JWT (Bearer access token) |
| Role | instructor |
| Success status | 200 |

**Response** — { deleted: true }

**Errors**
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)
- `409` Only drafts can be deleted

**Example**
```bash
curl -X DELETE "$BASE/api/v1/instructor/assessments/<draftId>" \
  -H "Authorization: Bearer $TOKEN"
```

## Integration (future)

### Sync enrollment

`POST /api/v1/integration/enrollments`

| | |
|---|---|
| Authentication | API key (x-api-key) |
| Role | service |
| Success status | 201 |

**Request body**
```json
{
  "externalStudentId": "stu-dev-001",
  "name": "Dev Student 01",
  "email": "dev.student01@example.test",
  "cohortId": "{{cohortId}}"
}
```

**Response** — { studentId, enrollmentId, cohortId }

**Errors**
- `400` Validation
- `401` Bad API key
- `404` Cohort not found

**Example**
```bash
curl -X POST "$BASE/api/v1/integration/enrollments" \
  -H "x-api-key: $INTEGRATION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"externalStudentId":"stu-dev-001","name":"Dev Student 01","email":"dev.student01@example.test","cohortId":"{{cohortId}}"}'
```

### Receive student submission

`POST /api/v1/integration/submissions`

| | |
|---|---|
| Authentication | API key (x-api-key) |
| Role | service |
| Success status | 201 |

**Request body**
```json
{
  "assessmentId": "{{assessmentId}}",
  "externalStudentId": "stu-dev-001",
  "content": "Answer text submitted from the Student Project"
}
```

**Response** — { submissionId, status: submitted } — notifies the instructor

**Errors**
- `401` Bad API key
- `403` Student not actively enrolled in the cohort
- `404` Assessment not found
- `409` Assessment not published OR duplicate submission

**Example**
```bash
curl -X POST "$BASE/api/v1/integration/submissions" \
  -H "x-api-key: $INTEGRATION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"assessmentId":"{{assessmentId}}","externalStudentId":"stu-dev-001","content":"Answer text submitted from the Student Project"}'
```

### Published assessments (student-facing)

`GET /api/v1/integration/assessments`

| | |
|---|---|
| Authentication | API key (x-api-key) |
| Role | service |
| Query | `cohortId` |
| Success status | 200 |

**Response** — Published assessments only — drafts are never returned

**Errors**
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)

**Example**
```bash
curl -X GET "$BASE/api/v1/integration/assessments" \
  -H "x-api-key: $INTEGRATION_API_KEY"
```

### Published results — before publishing (must be empty for this student/assessment)

`GET /api/v1/integration/results`

| | |
|---|---|
| Authentication | API key (x-api-key) |
| Role | service |
| Query | `externalStudentId`, `assessmentId` |
| Success status | 200 |

**Response** — Published results only

**Errors**
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)

**Example**
```bash
curl -X GET "$BASE/api/v1/integration/results" \
  -H "x-api-key: $INTEGRATION_API_KEY"
```

### Published results — after publishing

`GET /api/v1/integration/results`

| | |
|---|---|
| Authentication | API key (x-api-key) |
| Role | service |
| Query | `externalStudentId`, `assessmentId` |
| Success status | 200 |

**Response** — [{ submission, assessment, score, feedback, strengths, improvements, publishedAt }]

**Errors**
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)

**Example**
```bash
curl -X GET "$BASE/api/v1/integration/results" \
  -H "x-api-key: $INTEGRATION_API_KEY"
```

### Student attendance

`GET /api/v1/integration/attendance`

| | |
|---|---|
| Authentication | API key (x-api-key) |
| Role | service |
| Query | `externalStudentId`, `cohortId` |
| Success status | 200 |

**Response** — [{ session, status, markedAt }]

**Errors**
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)

**Example**
```bash
curl -X GET "$BASE/api/v1/integration/attendance" \
  -H "x-api-key: $INTEGRATION_API_KEY"
```

## Submissions

### List submissions of assessment

`GET /api/v1/instructor/assessments/{{assessmentId}}/submissions`

| | |
|---|---|
| Authentication | JWT (Bearer access token) |
| Role | instructor |
| Success status | 200 |

**Response** — Submission[] with student + result{status,score,publishedAt}

**Errors**
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)

**Example**
```bash
curl -X GET "$BASE/api/v1/instructor/assessments/<assessmentId>/submissions" \
  -H "Authorization: Bearer $TOKEN"
```

### List all my submissions

`GET /api/v1/instructor/submissions`

| | |
|---|---|
| Authentication | JWT (Bearer access token) |
| Role | instructor |
| Query | `status`, `assessmentId`, `cohortId` |
| Success status | 200 |

**Response** — Submission[]

**Errors**
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)

**Example**
```bash
curl -X GET "$BASE/api/v1/instructor/submissions" \
  -H "Authorization: Bearer $TOKEN"
```

### Get submission

`GET /api/v1/instructor/submissions/{{submissionId}}`

| | |
|---|---|
| Authentication | JWT (Bearer access token) |
| Role | instructor |
| Success status | 200 |

**Response** — Submission + student + assessment + result|null

**Errors**
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)

**Example**
```bash
curl -X GET "$BASE/api/v1/instructor/submissions/<submissionId>" \
  -H "Authorization: Bearer $TOKEN"
```

## Grading

### Save evaluation (not published)

`PUT /api/v1/instructor/submissions/{{submissionId}}/grade`

| | |
|---|---|
| Authentication | JWT (Bearer access token) |
| Role | instructor |
| Success status | 200 |

**Request body**
```json
{
  "score": 42,
  "feedback": "Solid work",
  "strengths": "Clarity",
  "improvements": "Add references"
}
```

**Response** — AssessmentResult (status evaluated) — NOT visible to students

**Errors**
- `400` Empty body / negative score
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)
- `409` Result already published (locked)
- `422` Score exceeds the assessment's configured maxScore

**Example**
```bash
curl -X PUT "$BASE/api/v1/instructor/submissions/<submissionId>/grade" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"score":42,"feedback":"Solid work","strengths":"Clarity","improvements":"Add references"}'
```

### Publish result

`POST /api/v1/instructor/submissions/{{submissionId}}/publish-result`

| | |
|---|---|
| Authentication | JWT (Bearer access token) |
| Role | instructor |
| Success status | 200 |

**Response** — AssessmentResult (status published)

**Errors**
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)
- `409` Not evaluated yet OR already published

**Example**
```bash
curl -X POST "$BASE/api/v1/instructor/submissions/<submissionId>/publish-result" \
  -H "Authorization: Bearer $TOKEN"
```

## Progress

### Student progress

`GET /api/v1/instructor/progress`

| | |
|---|---|
| Authentication | JWT (Bearer access token) |
| Role | instructor |
| Query | `cohortId` |
| Success status | 200 |

**Response** — Per student: attendance{totalSessions,present,absent,pending,attendancePercentage}, assessments{published,submitted,pendingGrading,graded,resultsPublished,notSubmitted}, trainingStatus

**Errors**
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)

**Example**
```bash
curl -X GET "$BASE/api/v1/instructor/progress" \
  -H "Authorization: Bearer $TOKEN"
```

## Notifications

### List notifications

`GET /api/v1/instructor/notifications`

| | |
|---|---|
| Authentication | JWT (Bearer access token) |
| Role | instructor |
| Query | `unread`, `page`, `limit` |
| Success status | 200 |

**Response** — Notification[] + meta{page,limit,total,unreadCount}

**Errors**
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)

**Example**
```bash
curl -X GET "$BASE/api/v1/instructor/notifications" \
  -H "Authorization: Bearer $TOKEN"
```

### Mark notification read

`PATCH /api/v1/instructor/notifications/{{notificationId}}/read`

| | |
|---|---|
| Authentication | JWT (Bearer access token) |
| Role | instructor |
| Success status | 200 |

**Response** — Notification

**Errors**
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)

**Example**
```bash
curl -X PATCH "$BASE/api/v1/instructor/notifications/<notificationId>/read" \
  -H "Authorization: Bearer $TOKEN"
```

### Mark all read

`POST /api/v1/instructor/notifications/read-all`

| | |
|---|---|
| Authentication | JWT (Bearer access token) |
| Role | instructor |
| Success status | 200 |

**Response** — { updated: true }

**Errors**
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)

**Example**
```bash
curl -X POST "$BASE/api/v1/instructor/notifications/read-all" \
  -H "Authorization: Bearer $TOKEN"
```

## Profile

### Get profile

`GET /api/v1/instructor/profile`

| | |
|---|---|
| Authentication | JWT (Bearer access token) |
| Role | instructor |
| Success status | 200 |

**Response** — User (safe)

**Errors**
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)

**Example**
```bash
curl -X GET "$BASE/api/v1/instructor/profile" \
  -H "Authorization: Bearer $TOKEN"
```

### Update profile

`PATCH /api/v1/instructor/profile`

| | |
|---|---|
| Authentication | JWT (Bearer access token) |
| Role | instructor |
| Success status | 200 |

**Request body**
```json
{
  "name": "Dev Instructor Layla Hassan",
  "phone": "+20000000001",
  "preferredLanguage": "en",
  "professional": {
    "title": "Systems Engineer (dev data)"
  }
}
```

**Response** — User. Only name, phone, preferredLanguage, professional.* are accepted; role/email/status are ignored.

**Errors**
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)

**Example**
```bash
curl -X PATCH "$BASE/api/v1/instructor/profile" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Dev Instructor Layla Hassan","phone":"+20000000001","preferredLanguage":"en","professional":{"title":"Systems Engineer (dev data)"}}'
```

### Change password

`PUT /api/v1/instructor/profile/password`

| | |
|---|---|
| Authentication | JWT (Bearer access token) |
| Role | instructor |
| Success status | 200 |

**Request body**
```json
{
  "currentPassword": "{{instructorPassword}}",
  "newPassword": "{{instructorPassword}}"
}
```

**Response** — { message } — all other sessions are signed out

**Errors**
- `400` Wrong current password / weak new password
- `401` Missing/invalid/expired token
- `403` Role is not instructor
- `404` Resource not found OR not assigned to the authenticated instructor (deliberately indistinguishable)

**Example**
```bash
curl -X PUT "$BASE/api/v1/instructor/profile/password" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword":"{{instructorPassword}}","newPassword":"{{instructorPassword}}"}'
```

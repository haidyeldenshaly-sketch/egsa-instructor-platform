# EGSA Space Academy — Instructor Mission Control

A **standalone** Instructor Management Platform for EGSA Space Academy. Instructors manage the academic side of the training they are assigned to: cohorts, sessions, attendance, assessments, grading, result publication, student progress and notifications.

It has its own frontend, backend, database, authentication and development data, and runs with the Student Project offline. It is **integration-ready** (stable IDs + API-key integration endpoints; see `INTEGRATION_CONTRACT.md`) but intentionally **not connected** to the Student Project.

## Architecture
```
 React (Vite, React-Bootstrap, CSS Modules)  ──/api/v1──▶  Express API ──▶ MongoDB
   Auth context · API client (refresh)                      routes → controllers → services → models
   i18n EN/AR (RTL)                                          JWT auth · role guard · ownership layer
                                                             /integration/* (API key) for the future Student Project
```
**Authorization model.** `authenticate` (JWT) → `authorize('instructor')` → **resource ownership**: every cohort, session, assessment, submission and student is resolved through `Cohort.instructor === JWT user`, in `services/ownership.service.js`. Foreign resources return `404` (no existence leak). The instructor id is never read from request input.

## Tech stack
Backend: Node 18+, Express, MongoDB/Mongoose (CommonJS), JWT, bcryptjs, helmet, cors, morgan, express-rate-limit, express-validator, nodemailer, dotenv.
Frontend: React 18, Vite, React-Bootstrap/Bootstrap 5, CSS Modules, Font Awesome. No Tailwind.

## Folder structure
```
backend/src/{config,models,middleware,validators,services,controllers,routes,seed,utils}
backend/tests/              node:test API suite (39 tests)
frontend/src/{pages,components,context,services,i18n,hooks,utils,styles}
e2e/ui_e2e.py               Playwright browser end-to-end (50 checks)
docs/{endpoints.js,build-docs.js}   source of API_REFERENCE.md + Postman
postman/                    collection + environment
API_REFERENCE.md  INTEGRATION_CONTRACT.md
```

## Design system & branding
- **Logo:** the official EGSA logo is used unmodified (`frontend/src/assets/egsa-logo.png`, byte-identical to the supplied file; also `public/egsa-logo.png` as favicon). The file is opaque on `#F7F7F7`, so `components/Logo.jsx` seats it on a plate of exactly that colour instead of editing the artwork. It appears in the sidebar/mobile menu, the mobile top bar and all auth screens (login, forgot, reset). Instructor accounts are provisioned by the Academy, so there is no public registration page in this project.
- **Tokens** (`styles/global.css`): palette (`#0E1A22`, `#3A6985`, `#1E7C85`, `#D4B87C`, `#DF4F4C`, `#F8FAFB`), 4px spacing scale, restrained radius scale (4/6/10px), 3 elevation levels, motion tokens, type scale.
- **Motion:** CSS-only (no animation library added): page transitions, collapsible sidebar, staggered dashboard entrance, eased stat count-up, skeleton loaders, dropdown/modal/toast transitions. All of it respects `prefers-reduced-motion`.
- **Media module:** removed entirely (model, service, routes, validators, seed, page, nav, i18n, tests, docs, Postman). A leftover `media` collection in an existing dev database can be dropped with `db.media.drop()`.

## Installation
```bash
# 1) MongoDB (any one):  docker compose up -d      |  local mongod on :27017  |  MongoDB Atlas URI
# 2) Backend
cd backend && cp .env.example .env     # set JWT secrets for anything non-local
npm install
npm run seed -- --reset                # DEVELOPMENT data only (refuses in production)
npm run dev                            # http://localhost:5100
# 3) Frontend
cd ../frontend && npm install && npm run dev    # http://localhost:5173 (proxies /api → :5100)
```
Dev logins (seed, password `Instructor#Dev123`): `instructor@egsa-dev.test` (main), `instructor.b@egsa-dev.test` (second instructor, for ownership tests), `admin@egsa-dev.test` (non-instructor role).

### Environment variables (`backend/.env`)
`PORT`, `MONGODB_URI`, `CLIENT_ORIGIN`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES`, `JWT_REFRESH_EXPIRES`, `INTEGRATION_API_KEY`, `SMTP_*` / `MAIL_FROM` (optional; without SMTP, reset links are printed in development only), `RATE_LIMIT_DISABLED` (tests/E2E only). Frontend: `VITE_API_PROXY`, `VITE_API_BASE` (production).

## Instructor permissions
| Can | Cannot |
|---|---|
| See only assigned courses/cohorts/sessions/students | Access any other instructor's resources (404) |
| Create/edit/cancel sessions in assigned cohorts | Accept/reject applications, change pricing, invoices, payments, refunds |
| Record attendance (present/absent/pending) for enrolled students | Record attendance for non-enrolled students or cancelled sessions |
| Create, edit (draft), publish, delete (draft) assessments | Edit a published assessment |
| Review submissions, save an evaluation, then publish the result | Publish a result that was never evaluated; change a published result |
| Edit own name/phone/professional info/password | Change role, email, status, permissions |

Result visibility: *saved evaluation* ≠ *published result*. Only published results are returned by `/integration/results`.

## Testing
```bash
cd backend && npm test                     # 39 API tests (isolated DB egsa_instructor_test)
# Postman: import postman/*.json, set instructorPassword + integrationApiKey, run top-to-bottom on a freshly seeded DB
npx newman run postman/EGSA-Instructor.postman_collection.json -e postman/EGSA-Instructor.local.postman_environment.json --env-var instructorPassword='Instructor#Dev123' --env-var integrationApiKey=<key>
# Browser E2E (needs stack running, seeded DB, API started with RATE_LIMIT_DISABLED=true)
pip install playwright && python3 e2e/ui_e2e.py ./screenshots
```
Regenerate docs/Postman after changing `docs/endpoints.js`: `node docs/build-docs.js`.

## API overview
50 endpoints under `/api/v1`: `auth`, `instructor/{dashboard,courses,cohorts,sessions,students,attendance,assessments,submissions,progress,notifications,profile}`, `integration/*`. See `API_REFERENCE.md`.

## Progress & attendance semantics
Attendance % = present ÷ (present + absent) over **recorded** sessions, `null` if none recorded. **No threshold, pass mark, grading scale or overall progress % is defined or invented**; the UI shows the underlying metrics.

## Future Student integration
See `INTEGRATION_CONTRACT.md` (IDs, auth, payloads, endpoints required later, undefined business rules).

## Known limitations
- Course/cohort/instructor assignment are created by seed data only (Admin system owns them in the target architecture).
- Dynamic activity-log sentences are generated in English; user-entered content is shown as entered.
- Refresh tokens live in `localStorage` (XSS trade-off); move to httpOnly cookies behind the same origin for production.
- No file upload handling (attachments are URL references).

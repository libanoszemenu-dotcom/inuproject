# INU upgrade - what changed

## Correction to the earlier gap analysis
Two rows of the first analysis were wrong after reading the code in detail: expired vacancies **were** already auto-closed
(hourly job in `server.js`) and logins **were** already written to the audit log. Both are now improved (5-minute job with an
audit entry per vacancy; separate `login_events` table with method, result, reason, IP and browser).

## Database (`database/migrations/002_inu_upgrade.sql`, applied by `npm run migrate`)
- `roles`: `committee` renamed to `department_head`; all four roles guaranteed
- `users`: + `department_id`, `auth_provider`, `google_sub`, `email_verified_at` (existing accounts are marked verified)
- new tables: `email_verification_tokens`, `login_events`, `profile_education`, `profile_experience`, `profile_skills`, `vacancy_skills`
- `screening_evaluations.stage`: `committee` -> `department_head`
- `interviews.duration_minutes` (default 45) + index on panel members for overlap queries
- `schema.sql`: fixed a syntax error in the first statement (stray `;` after `CREATE DATABASE`)

## API changes
| Endpoint | Change |
|---|---|
| `POST /auth/google`, `GET /auth/config` | new - Google ID-token sign-in; public config for the button |
| `POST /auth/verify-email`, `POST /auth/resend-verification` | new - email verification (applying requires a verified email when `REQUIRE_EMAIL_VERIFICATION=true`) |
| `POST /auth/login`, `/auth/register` | login events recorded; verification email sent on register |
| `GET/PUT /profile` | now includes `education[]`, `experience[]`, `skills[]` (a list that is sent replaces the stored list) |
| `POST /profile/resume/parse` | new - PDF/DOCX -> suggested profile data (nothing stored, file discarded) |
| `POST/PATCH /applications/:id/status` | HR **and Department Head**; allowed transitions depend on the role |
| `GET /applications`, `/applications/:id`, document download | Department Head sees applications of own department + assigned ones |
| `GET /applications/:id` (staff) | + education/experience/skills and an informational `skill_match` |
| vacancies `POST/PUT/GET` | + `required_skills[]` |
| `POST /interviews` | + `duration_minutes`; 409 with details when a panel member or the applicant is double-booked |
| `POST /interviews/check-conflicts` | new - preview conflicts without saving |
| `GET/POST/PUT/DELETE /departments` | new - administrator manages departments |
| `POST/PATCH /users` | + `department_id` (required for Department Heads) |
| `GET /audit-logs/logins` | new - login events |

## Department Head permissions
Sees: applications of vacancies in the own department, plus applications assigned by HR. Can: evaluate (stage `department_head`),
record interview feedback, and move applications `under_review -> screened -> shortlisted`, `interview_completed -> selected`,
or reject with a reason. Cannot: do the HR intake step (`submitted -> under_review`), schedule interviews, manage vacancies.
These rules are in `server/src/utils/statusWorkflow.js` (`DEPARTMENT_HEAD_MANUAL`) and are easy to change.

## Client
Branding (title, header, sidebar, footer, login text); role navigation for all four roles; profile builder with CV import;
pipeline board; interview scheduling with duration, availability check and conflict messages; Google button; email-verification
page and banner; departments page; Department Head assignment in user management; login-events tab; vacancy skills.

## Security clean-up
`server/.env` and the 20 uploaded files under `uploads/private` were removed from the package; `.env.example` documents every
variable; the server refuses placeholder/short `JWT_SECRET` and, in production, a non-https `CLIENT_ORIGIN` or an empty `DB_PASSWORD`.
**The JWT secret that was inside the zip you uploaded must be considered exposed: use a new one.**

## What was and was not tested (be honest in your defence)
Tested here: unit tests (`npm test`) for the CV parser, overlap rule and Google token checks; the Express app starts and routes,
validation and authentication respond correctly; all 43 client source files parse and every import resolves.
**Not tested here** (no database server or network in my environment): the SQL migration and all SQL queries against a real MySQL,
`pdf-parse`/`mammoth` on real CVs, the Google button, SMTP delivery, and `vite build`. Run the steps in `DEPLOYMENT.md` section 0
and expect to fix small things. `package-lock.json` of the server was removed because dependencies changed; `npm install` creates it again.

## Not implemented
Automatic email notifications for status changes/interviews (only the verification email is sent), skill-based ranking (only an
informational matched/missing list is shown), password reset by email, and the old `TECHNICAL_DOCUMENTATION.md` was not rewritten.

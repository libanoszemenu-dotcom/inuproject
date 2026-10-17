# Injibara University (INU) - Web-Based Job Recruitment and Applicant Tracking System

Node.js / Express / MySQL REST API (`server/`) and React + Vite + Tailwind client (`client/`).

| Role | What they can do |
|---|---|
| Applicant | Register (email or Google), verify email, build a profile (education, experience, skills; CV import), apply, track status, see interviews |
| HR / Recruitment Officer | Manage vacancies (with required skills), process applications, assign Department Heads, schedule interviews (conflict-checked), reports |
| Department Head | See applicants of the own department (and assigned ones), evaluate, move applications through the department workflow, give interview feedback |
| System Administrator | Users and roles, departments, vacancy approval, audit log and login events |

Pipeline: Applied -> Under review -> Screened -> Shortlisted -> Interview (scheduled / completed) -> Selected / Not selected.

Start here: **[DEPLOYMENT.md](DEPLOYMENT.md)** (local setup in section 0, production in sections 1-10).
`server/.env.example` lists every setting. `database/migrations/002_inu_upgrade.sql` is the INU upgrade of the original schema.
`TECHNICAL_DOCUMENTATION.md` (if present) describes the earlier version and still uses the old role name "committee".

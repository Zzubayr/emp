# EMP · EMSS Mentorship Platform

One place to run a university mentorship program: onboard cohorts, pair mentors and mentees across
academic and non-academic tracks, book sessions, send reminders, record attendance, collect feedback
and report on impact. Built from the *Product Plan & Design Handoff* (MVP / Phase 1 scope).

Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · Prisma + SQLite · [Kokonut UI](https://kokonutui.com) and shadcn/ui components.

## Quick start

```bash
cp .env.example .env
```

```bash
npm install
```

```bash
npm run setup
```

```bash
npm run dev
```

`npm run setup` creates the database and loads demo data (two cohorts, ten tracks, 64 people, pairs,
sessions and feedback). Open http://localhost:3000 and sign in with a demo account. In demo mode the
one-time code is shown on screen.

| Account | Role | Try |
| --- | --- | --- |
| `admin@emp.local` | Super admin | Dashboard, new cohort, import, assignment, settings |
| `coordinator@emp.local` | Track coordinator | Sees only the Tech and Design tracks |
| `mentor@emp.local` | Mentor | Requests inbox, mentees, session notes |
| `mentee@emp.local` | Mentee | Paired in 100 Level; can request a mentor in Tech |
| `new@emp.local` | Mentee (invited) | First sign-in and the onboarding wizard |

## Onboarding a new cohort

1. **Cohorts → New cohort.** Name, dates, which tracks, and (optionally) carry mentors over from an earlier cohort.
2. **People → Import.** Upload a CSV or paste rows (`name, email, role, track, level, faculty, student id, notes`).
   Every row is checked first; bad emails, duplicates and unknown tracks are reported and skipped.
3. **Send invites.** On import, or in bulk from the People table. Unused invites are re-sent on day 3, 7 and 14.
4. People sign in with an emailed one-time code, accept the terms and finish a short profile.
5. **Assignment.** Each track uses one of five modes (admin assigns, suggest then confirm, student picks,
   student requests, rank and allocate). Change the mode per track in **Tracks**.
6. **Mark the cohort active.** The cohort page shows the checklist and a live funnel from invite to first session.

Use the cohort switcher in the sidebar to work in a different cohort. Returning people keep their profile and history.

## What is included

- Invite-only allow list, OTP sign-in (6 digits, 10 minutes, single use, rate limited, lockout after 5 wrong tries)
- Roles: mentee, mentor, track coordinator (scoped to their tracks), program admin, super admin
- Cohorts, tracks and per-track rules (assignment mode, selection window, capacity, session lengths, attendance rules)
- Matching score with reasons, hard exclusions, bulk assignment, mentor capacity
- Availability, mutual free-slot booking across time zones, propose / confirm / reschedule / cancel, late-cancel tracking
- Meeting links: Google Meet API when configured, otherwise a pair's fixed room or a pasted Meet link
- Join button that logs attendance, outcome logging, attendance results and audited overrides
- Shared and private session notes, action items, agenda templates, calendar (.ics) files
- Feedback (three ratings), low-score alerts, pair health score (Healthy / Quiet / At risk)
- Reminder engine driven by editable rules; in-app notifications and email
- Safety reporting, case management with append-only notes, auto-pause on serious reports
- Admin dashboard, reports against the plan's success metrics, CSV exports, audit log, email log
- Light and dark mode, responsive layout with a bottom tab bar on phones

## Configuration (`.env`)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLite file by default. See "Going to production". |
| `APP_URL` | Public URL, used in emails and calendar files. |
| `ADMIN_EMAIL` | First super admin created by the seed. |
| `SHOW_DEV_CODES` | `true` shows sign-in codes on screen. **Must be `false` in production.** |
| `CRON_SECRET` | Secret for `/api/cron/tick` and for hashing sign-in codes. Change it. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Email delivery. Without these, emails are only written to **Settings → Email log**. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` | Organizer account for creating Google Meet spaces. Optional. |
| `DISABLE_TICK` | `true` turns off the in-process reminder timer (use an external cron instead). |

Reminders run once a minute inside the server process. On serverless hosting, set `DISABLE_TICK=true`
and call `GET /api/cron/tick?key=$CRON_SECRET` every minute or two from a scheduler.

## Going to production

- Set `SHOW_DEV_CODES=false`, a strong `CRON_SECRET`, `APP_URL` (https) and SMTP settings.
- Start from an empty database: run `npm run db:push`, then create your first super admin
  (the seed script creates demo data; do not run it against production).
- SQLite suits a single server with a persistent disk. For managed hosting, change the `provider`
  in `prisma/schema.prisma` to `postgresql`, point `DATABASE_URL` at it and run `npm run db:push`.
- `npm run build` then `npm run start`.

## Not built yet (from the plan)

- **Reading Google Meet attendance records.** The plan's week-one spike (confirming participant data
  with a Workspace organizer account) has not been run. Link creation through the Meet API is written
  in `src/lib/meet.ts` but has not been exercised against a live Google account. Attendance currently
  comes from the Join button and logged outcomes, which the plan names as the fallback.
- Recurring session series, calendar busy-time sync, SMS and push, guardian consent for under-18s,
  background checks and mentor training quizzes, quiet hours and daily digests.
- Phase 2 and 3 modules: goals, help desk, messaging, resources, surveys, certificates, AI features.
- An editable roles matrix (roles are fixed; see **Settings → Roles**).

Have your institution review the terms, privacy notice and safeguarding process (`/legal`) before launch.

## Tests

```bash
npm test
```

Runs three layers: unit tests for time zones, slot maths, CSV and health scoring; integration tests for the
reminder engine against a seeded test database; and Playwright browser tests for sign-in security, access
control, assignment (single, bulk, rank and allocate), feedback, reschedule and cancel, and safety cases.
The browser tests use their own database (`prisma/test.db`) and never touch your data.

## Project layout

```
prisma/schema.prisma     data model          prisma/seed.ts   demo data
src/lib/                 domain logic: auth, matching, slots, reminders, health, meet, mail
src/actions/             server actions (every one checks the caller's role and scope)
src/app/(app)/           signed-in screens; admin console under admin/
src/components/kokonutui Kokonut UI components (vendored)
src/components/app       shared app components
```

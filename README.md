# EMSS Mentorship Programme

One place to run a university mentorship program: onboard cohorts, pair mentors and mentees across
academic and non-academic tracks, book sessions, send reminders, record attendance, collect feedback
and report on impact. Built from the *Product Plan & Design Handoff* (MVP / Phase 1 scope).

Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · Prisma + PostgreSQL · [Kokonut UI](https://kokonutui.com) and shadcn/ui components.

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

You need a local PostgreSQL server (the default `.env` expects `postgres:postgres@localhost:5432/emp`).
`npm run setup` creates the tables and loads demo data (two cohorts, ten tracks, 64 people, pairs,
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
| `DATABASE_URL` | PostgreSQL connection string (on Supabase: the transaction pooler). Falls back to `POSTGRES_PRISMA_URL`, set by the Supabase integration. |
| `DATABASE_URL_UNPOOLED` | Connection for migrations (on Supabase: the session pooler). Falls back to `POSTGRES_URL_NON_POOLING`. |
| `APP_URL` | Public URL, used in emails and calendar files. |
| `ADMIN_EMAIL` | First super admin: on an empty database this email can sign in. The demo seed also uses it. |
| `SHOW_DEV_CODES` | `true` shows sign-in codes on screen. **Must be `false` in production.** |
| `CRON_SECRET` | Secret for `/api/cron/tick` and for hashing sign-in codes. Change it. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Email delivery. Without these, emails are only written to **Settings → Email log**. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` | Organizer account for creating Google Meet spaces. Optional. |
| `DISABLE_TICK` | `true` turns off the in-process reminder timer (use an external cron instead). |

Reminders run once a minute inside the server process on a normal server. On Vercel that timer is switched
off automatically; see "Deploying to Vercel" for scheduling.

## Deploying to Vercel with Supabase

The app needs a hosted PostgreSQL database; Supabase is the supported one.

1. **Connect Supabase.** In the Vercel project: Storage → Create Database → Supabase (or connect an existing
   Supabase project from the Vercel Marketplace). This sets `POSTGRES_PRISMA_URL` and `POSTGRES_URL_NON_POOLING`
   on the project, and the app reads them automatically:
   - the app uses the pooled connection (port 6543); `pgbouncer=true` and a one-connection limit are added for you;
   - migrations use the session connection (port 5432), which works over Vercel's IPv4 network.

   Not using the integration? Set `DATABASE_URL` to Supabase's **transaction pooler** string and
   `DATABASE_URL_UNPOOLED` to its **session pooler** string (Supabase dashboard → Connect).
2. **Environment variables** (Settings → Environment Variables, Production):
   - `ADMIN_EMAIL`: your email. On an empty database, this address can sign in and becomes the first super admin;
     the ten starting tracks are created at the same time.
   - `CRON_SECRET`: a long random string.
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`: required, because sign-in codes are emailed.
     For example with Resend: host `smtp.resend.com`, port `465`, user `resend`, password = your API key,
     and a `MAIL_FROM` on a domain you have verified with them.
   - `APP_URL`: optional; defaults to the Vercel production URL.
   - Never set `SHOW_DEV_CODES` in production.
3. **Redeploy.** The build runs the migrations, so tables are created or updated on every deploy.
   The build log shows `[db] app: … · migrations: …` with the hosts it used.
4. **Sign in** with `ADMIN_EMAIL`, finish the short profile, then create your first cohort.
   If email is not working yet, the code is also stored in the `EmailMessage` table (newest row for your
   address): Supabase dashboard → Table Editor → EmailMessage.
5. **Reminders.** `vercel.json` runs the reminder engine once a day, which is all the Hobby plan allows.
   For reminders on time (24 hours and 1 hour before sessions), call
   `GET https://YOUR-APP/api/cron/tick` every 5 minutes with the header `Authorization: Bearer YOUR_CRON_SECRET`,
   from a free scheduler such as cron-job.org, or upgrade to Vercel Pro and change the schedule to `*/5 * * * *`.

**Supabase's REST API is switched off for this app's tables.** Supabase normally exposes every table to
anyone holding the public "anon" key. A migration turns on row level security with no policies and removes the
API roles' access, so the data is only reachable through the app. The Supabase dashboard may list the tables
as having RLS with no policies; that is intended. Do not add policies or grants unless you mean to publish data.

Never run `npm run db:seed` against production: it deletes everything. It refuses to run on a non-local
database unless `SEED_ALLOW_REMOTE=yes` is set, which is only for a throwaway demo database.

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
The tests use their own database (`emp_test` on your local Postgres, or `TEST_DATABASE_URL`) and never touch your data.

## Project layout

```
prisma/schema.prisma     data model          prisma/seed.ts   demo data
src/lib/                 domain logic: auth, matching, slots, reminders, health, meet, mail
src/actions/             server actions (every one checks the caller's role and scope)
src/app/(app)/           signed-in screens; admin console under admin/
src/components/kokonutui Kokonut UI components (vendored)
src/components/app       shared app components
```

## Brand

Follows the EMSS 25/26 Figma: navy `#182346`, cyan `#3ED9D9`, the MSSN crest (`public/brand/`), the
navy title box with a cyan outline, cyan dot bullets and the navy footer bar. The licensed brand fonts
(Tomato Grotesk, Monument Extended) are stood in for by Hanken Grotesk and Unbounded, with Allura for the
"Presents" script. To use the real fonts, add the files and switch `src/app/layout.tsx` to `next/font/local`.

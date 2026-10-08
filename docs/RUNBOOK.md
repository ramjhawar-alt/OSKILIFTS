# OSKILIFTS runbook

How the pieces fit together, how to change them safely, and where the settings live.

## Where things run

| Piece | Where | Deploys from |
| --- | --- | --- |
| Web app (Expo web export) | Vercel, `oskilifts.com` | push to `main` |
| API server (RSF crowd data, classes, email jobs) | Render, `oskilifts.onrender.com` | push to `main` |
| Database, auth, row-level security | Supabase | SQL run by hand (see below) |
| Email delivery | Resend (domain `oskilifts.com`, DNS on Vercel) | Supabase SMTP + the server's API key |
| Scheduler for email jobs | GitHub Actions (`.github/workflows/email-jobs.yml`) | push to `main` |

## Secrets and settings (never commit these)

**Vercel** (Project → Settings → Environment Variables, names must be UPPERCASE):
`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Changing them needs a redeploy.

**Render** (Environment):
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server only, never the app),
`RESEND_API_KEY` (a *sending-access* key for `oskilifts.com`),
`JOB_SECRET` (a long random string, at least 24 characters; the email endpoints stay disabled without it).
Optional: `EMAIL_FROM_DIGEST`, `EMAIL_FROM_ALERTS`, `SUPPORT_EMAIL`, `API_PUBLIC_URL`, `APP_PUBLIC_URL`.

**GitHub** (Repo → Settings → Secrets and variables → Actions): `JOB_SECRET`, the same value as on Render.

**Supabase** → Authentication → Emails: custom SMTP is Resend (`smtp.resend.com`, port 465, user `resend`,
password = a Resend API key). The Confirm signup and Reset Password templates must keep a link
(`{{ .ConfirmationURL }}`) in them.

## Database changes

Migrations live in `server/migrations/NNN_*.sql`, are idempotent, and are pasted into the
Supabase SQL editor by hand, **before** the code that needs them is merged.

1. Write the migration and a test in `server/tests/*_test.sql` (tests run in a transaction that rolls back,
   so they are also safe in the Supabase editor).
2. `npm run test:sql` runs every migration twice and every test against an in-process Postgres (PGlite).
   `node server/tests/local/run.mjs --only=<file>` runs one test.
3. Break the new rules on purpose (mutation testing) and make sure a test fails each time.
4. Paste the migration into the Supabase SQL editor and run it.
5. Paste `server/tests/security_audit_test.sql` into the editor and run it. It must finish with no error.
   It checks every table and function against the project's rules (row-level security everywhere, nothing for
   the signed-out role, closed tables stay closed, security-definer functions pin `search_path`, server-only
   functions are not callable by app users).
6. Merge to `main` (fast-forward) and push.

Gotchas: re-running an older migration can undo a later one (`004`/`005`/`008` replace functions that
`009`/`011` redefine; re-running `003` revokes later column grants). Re-run the later file if you ever do.

## Checks before merging code

```
npm run typecheck     # a few existing errors are known (debuggerHost, AnimatedOskiLifting, PeakHoursChart, a couple of screens)
npm run test:unit     # src/domain and server/tests/unit
npm run test:sql      # migrations + SQL tests + the security audit
npm run web:build
```

## Admins and moderation

`public.admins` lists who can use Me → Moderation. Add one in the SQL editor:

```sql
insert into public.admins (user_id)
select id from auth.users where lower(email) = 'someone@berkeley.edu'
on conflict do nothing;
```

## Email

* Account emails (confirm sign-up, reset password) go through Supabase → Resend.
* The weekly recap is opt-in (off by default), sent Sunday evening Pacific, only when something happened.
  It contains counts and up to three new followers' usernames, nothing else. Every email has a one-click
  unsubscribe link served by the Render server (`/unsubscribe`).
* The admin alert emails admins at most once a day, only while reports are open.
* To test a job by hand: GitHub → Actions → "Email jobs" → Run workflow. Check Resend → Emails afterwards.
* If the free Render server is asleep the job retries while it wakes. The server never emails the same person
  twice within six days.

## Not built (decisions)

* Gym-partner finder: only after 200+ users, and after a safety review.
* Background location tracking: not wanted. "At the RSF" only checks while the app is open.
* Weights-based leaderboards: replaced by days trained (hard to fake).

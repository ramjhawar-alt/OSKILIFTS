# OSKILIFTS

OSKILIFTS is a production-style, full-stack app that improves how students access campus fitness data.  
It unifies live weight room occupancy, class schedules, and crowd insights in one cross-platform product (web + mobile).

## Live Project

- **Web App:** [https://oskilifts.com](https://oskilifts.com)

## Product Problem and Outcome

RecWell usage data is publicly available but fragmented across separate tools and pages.  
OSKILIFTS turns those fragmented sources into a single, fast, mobile-first experience with reliability safeguards (timeouts, caching, environment fallbacks) that mirror real production constraints.

## Core Features

- Check RSF weight room crowd levels in real time before heading over.
- Browse upcoming group fitness classes without jumping between multiple sites.
- Log workouts and keep a running history of your training sessions.
- Track workout consistency over time, tied to Oski Bear progression and level-ups.
- Use Hoopers check-in/check-out to see how busy the courts are right now.

## Engineering Highlights

- **Cross-platform client architecture:** One React Native/Expo codebase serves iOS, Android, and web.
- **Backend reliability:** Express API uses JSON-safe handlers, route-specific cache headers, and explicit API 404 handling.
- **Environment-aware networking:** Client runtime dynamically resolves API base URLs for simulator, local device, localhost, and production.
- **Performance strategy:** Multi-layer caching (server + client) reduces request volume while preserving freshness for high-change endpoints.
- **Analytics pipeline:** Scheduled server jobs collect occupancy samples and expose derived peak-hours analysis.

## System Design

- **Frontend (`src/`):** Navigation, screens, and typed service layer for all API calls.
- **Backend (`server/`):** Data adapters, orchestration endpoints, and analysis services.
- **Deployment model:** Web frontend on Vercel, API on Render, with local development fallback.
- **Serving strategy:** Backend can optionally serve the exported web build from `dist/` for single-service hosting.

## Tech Stack

- **Frontend:** React Native, Expo, TypeScript, React Navigation
- **Backend:** Node.js, Express
- **Analytics storage:** Supabase (Postgres) for peak-hours snapshots (survives deploys)
- **Data integration:** Public Density and Mindbody widget endpoints
- **Infra:** Vercel (web), Render (API)

### Peak hours / Supabase

Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` on the Render service (and in `.env` locally). Run the SQL in [`server/migrations/001_capacity_snapshots.sql`](server/migrations/001_capacity_snapshots.sql) once in the Supabase SQL editor. Without these variables, the API still runs but snapshots are not persisted.

**Render free tier:** instances sleep after ~15 minutes of no traffic, which pauses the 5‑minute snapshot job. For steadier coverage, use an external uptime ping (e.g. cron-job.org or UptimeRobot) every ~10 minutes against `GET /api/health`.

## API Surface (Selected)

- `GET /api/health` - service health and timestamp
- `GET /api/weightroom` - occupancy snapshot
- `GET /api/classes?startDate=YYYY-MM-DD` - class feed
- `GET /api/hoopers` - current hoopers crowd estimate
- `POST /api/hoopers/checkin` and `POST /api/hoopers/checkout` - user crowd signals
- `GET /api/peak-hours` - derived usage analytics

## Repository Layout

- `src/` - Expo app UI, navigation, and API clients
- `server/` - Express routes, integrations, and analytics jobs
- `dist/` - optional web export artifacts
- `TECHNICAL_DOCUMENTATION.md` - detailed architecture and endpoint notes

## Local Development (Quick Reference)

Most recruiters and reviewers can use the deployed app directly.  
If you want to run locally:

```bash
npm install
cp env.example .env
npm run server
# in another terminal
npm start
```

Optional web export:

```bash
npm run web:build
```

## Disclaimer

OSKILIFTS is an independent project and is not affiliated with or endorsed by UC Berkeley, RecWell, Density, or Mindbody.  
It consumes only publicly exposed endpoints used by official public-facing pages.

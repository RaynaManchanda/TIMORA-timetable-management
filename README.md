# TIMORA
### Dynamic Academic Scheduling & Student-Day Optimization Platform

TIMORA is an academic timetable management system that loads the college's timetable workbook, serves it to students, faculty and coordinators, and adapts it (with human approval) when classes are disrupted.

---

## 1. Project Architecture & Work Division

| Member | Module | Key Responsibilities & Capabilities |
| :--- | :--- | :--- |
| **Person 1 — Rishank** | **Core Scheduling & Optimization** | Constraint model, credit-based scheduling, timetable generation, conflict detection, student-day gap minimization, and timetable quality scoring. |
| **Person 2 — Rayna** | **Adaptive Rescheduling & AI Smart Features** | Disruption detection, impact analysis, alternative schedule generation, minimum-disruption scoring, approval workflows, versioning, rollback, and AI constraint assistance. |
| **Person 3 — Rohit** | **Frontend, Analytics & User Workflows** | Dashboard, interactive timetable matrix, disruption and alternative comparison UI, versions and analytics, notifications center, and calendar sync UI. |
| **Person 4 — Raghav** | **Backend, Database, Quality & DevOps** | PostgreSQL 16 + Prisma schema and repositories, JWT authentication with bcrypt, role-based access control, injection-safe input validation, login rate limiting, notifications and Google Calendar backend, Jest test suite, Docker Compose deployment. |

---

## 2. Prerequisites

- **Node.js** 20 or higher and **npm** 9 or higher
- **Docker** with Docker Compose (runs PostgreSQL 16 for development, tests and deployment)

---

## 3. Quick start (development)

```bash
npm install
npm run dev                   # http://localhost:3000
```

`npm run dev` first runs `scripts/dev-setup.mjs` (the npm `predev` hook), which on a fresh machine does everything for you:

1. starts Docker Desktop if it is not running,
2. creates `.env` from `.env.example` with generated secrets if there is none (add your Google credentials there later),
3. starts the PostgreSQL 16 container (`docker compose up -d --wait db`, host port 5434),
4. **loads `database/timora-dev.dump.sql`** (the college timetable already imported) when the database is empty,
5. applies Prisma migrations that are newer than the dump.

An existing database is never overwritten by `npm run dev`. `npm run db:flash` replaces it with the dump on purpose; `npm run db:dump` rewrites the dump from your running dev database (without users, Google tokens, disruptions, drafts or extra versions). The demo accounts are created when the server starts.

The older manual route still works: `npm run db:up`, then `npm run db:setup` (migrate + import the workbook).

`npm run db:setup` is safe to repeat: migrations already applied are skipped and a workbook that was already imported is not imported twice.

### Everything in Docker

```bash
export POSTGRES_PASSWORD=choose_a_password
export JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
docker compose up --build     # database + API + frontend on http://localhost:3000
```

The API container applies the Prisma migrations, imports `data/*.xlsx` (set `IMPORT_ON_START=false` to skip) and then starts. Demo accounts are **not** created in this mode unless you set `SEED_DEMO_DATA=true`.

---

## 4. The database (PostgreSQL 16 · Prisma · connection pool)

| Piece | Where |
| :--- | :--- |
| Data model | `prisma/schema.prisma` |
| Migrations (also contain the rules Prisma cannot express) | `prisma/migrations/` |
| Pool + Prisma client | `src/db/database.js` — one `pg.Pool` (size `DATABASE_POOL_SIZE`, default 20) that Prisma uses through `@prisma/adapter-pg` |
| Transactions | `src/db/transaction.js` → `withTransaction(prisma, tx => …)` |
| Repositories (data access only) | `src/repositories/*` |

Useful commands:

| Command | What it does |
| :--- | :--- |
| `npm run db:up` / `db:down` | start / stop the PostgreSQL container |
| `npm run db:migrate` | apply pending migrations (`prisma migrate deploy`) |
| `npm run db:migrate:dev` | create a new migration after editing `schema.prisma` |
| `npm run db:studio` | browse the data in Prisma Studio |
| `npm run db:import` | import the newest workbook in `data/` (or pass a path) |

### Rules enforced by the database itself

* a teacher teaches one class per slot (project-guidance sessions are exempt: they are supervised by a panel),
* a room hosts one class per slot (shared facilities such as workshops are exempt),
* a section has one core class per slot (elective classes run in parallel on purpose),
* at most one timetable version is `ACTIVE`,
* a subject / teacher / room / section that a class still uses cannot be deleted.

---

## 5. The college timetable workbook

`data/2024 Batch V wef 24th Aug 26. Ver III.xlsx` is the format sent by the college administration. TIMORA reads it directly:

| In the workbook | In the database |
| :--- | :--- |
| Sheets `24-CSE I` … `24-ME`, `24-ECoM` | `sections` (+ the weekly grid → `timetable_entries`) |
| Nine hourly columns 9:00 – 5:55 | `time_slots` `S1`–`S9` |
| Course table at the right of each sheet | `subjects` (code, title, abbreviation, category, L-T-P, credits) |
| "Course Faculty" column, `Faculty TT` sheet | `faculty` (+ department) |
| Room written in a cell (`NB 314`, `GA202B`, workshops), `LAB` sheets | `rooms` (classroom / lab / shared workshop) |
| `LUNCH`, `DSW/ ECC-II/ Mentor meeting`, `Minor …`, `Industry expert …` | `section_blocks` — lunch really is a different hour per section and day |
| `ADS CSEV+CSEVI NB 315` (one class for two sections) | **one** entry with `co_section_ids` |
| `CE&DHA 314 / BDA 307 / SAD 311 / AD&ST 312` (parallel electives) | one entry each, flagged `is_elective` |
| The text of the cell itself | `timetable_entries.source_cell` (audit) |

Each import creates a **new timetable version** and archives the previous one, so a later "Ver IV" can simply be imported next to this one:

```bash
npm run db:import -- "path/to/2024 Batch V wef 7th Sep 26. Ver IV.xlsx"
```

Cells that cannot be loaded are **reported, never guessed**. They are printed by the import and stored in `import_batches.issues`. For the current workbook there is one: *CSE III, Friday 10:00 asks for room NB307, which CSE I already uses for IoT-NAA at that time* — please confirm with the college which one is right.

Not in the workbook, so loaded as **placeholders** to be corrected in the Academic Data screen: class sizes (60 per section), room capacities (70), and faculty e-mail addresses (`first.last@faculty.timora.invalid`, an address that can never receive mail). The `Faculty TT` and `LAB` sheets describe other batches' occupancy and are used only for faculty departments and the list of lab rooms.

---

## 6. Authentication & access control

| Concern | How it is handled |
| :--- | :--- |
| Passwords | bcrypt (cost 12), policy: 8–72 characters with upper-case, lower-case and a digit |
| Sessions | signed JWT (HS256, issuer-checked, 60 min); the signing key is a pre-built key object |
| Every request | the account is **loaded again from PostgreSQL**: a disabled account, a changed role or a revoked token takes effect on the very next request (`AUTH_CACHE_MS` can trade this for speed) |
| Revoking tokens | changing the password, or `POST /api/auth/logout-all`, bumps the user's `token_version` |
| Brute force | per-account lockout (5 failures / 15 min) **and** per-IP limit on login / register / change-password |
| Roles | `ADMIN`, `COORDINATOR` (manage everything) · `FACULTY` (own classes) · `STUDENT` (own section) — enforced on the server, not only in the UI |
| Data scoping | students and faculty only ever receive their own timetable from the API |
| Approvals | the AI and the engine only *propose*; the approved timetable is rebuilt on the server from the chosen option id — a client can't submit its own timetable |
| Transport hardening | `helmet` headers incl. a strict Content-Security-Policy, `Cache-Control: no-store` on the API, CORS closed unless `CORS_ORIGINS` is set |
| Frontend | session verified with `/api/auth/me` on load, 401 → sign-in screen, data wiped on sign-out, pages guarded by role, all database text HTML-escaped, change-password dialog |
| Production | refuses to start without a 32+ character `JWT_SECRET`; demo accounts only when `SEED_DEMO_DATA=true` |

### Creating the first coordinator (production)

Demo accounts are off in production and self-registration only creates students and faculty, so create the first administrator from the command line (a strong password is generated and shown once; change it after signing in):

```bash
npm run user:create -- --email registrar@college.edu --name "Registrar" --role COORDINATOR
docker compose exec api node scripts/create-user.js --email registrar@college.edu --name "Registrar" --role COORDINATOR
```

### Demo accounts (development only — `SEED_DEMO_DATA=true`)

| Role | Email | Password |
| :--- | :--- | :--- |
| Academic Coordinator | `admin@timora.edu` | `Password123!` |
| Faculty (Dr. Shilpa Mahajan) | `faculty@timora.edu` | `Password123!` |
| Student (CSE V) | `student@timora.edu` | `Password123!` |

---

## 6b. Google Calendar

Each user connects their own Google account on the **Settings** page (*Connect Google Calendar*), then *Sync now* copies their timetable into their calendar as weekly recurring events. Syncing again updates the same events. The server needs OAuth credentials in `.env`:

1. [Google Cloud Console](https://console.cloud.google.com/) → create/select a project → **APIs & Services → Library → enable "Google Calendar API"**.
2. **OAuth consent screen**: add your users as *test users* while the app is in testing.
3. **Credentials → Create credentials → OAuth client ID → Web application**. Add `http://localhost:3000/` (your `GOOGLE_REDIRECT_URI`, exactly, with the trailing slash) under *Authorised redirect URIs*.
4. Put the values in `.env` and restart:

```
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/
TOKEN_ENCRYPTION_KEY=<32+ random characters>
```

Google's access and refresh tokens are stored **AES-256-GCM encrypted** (key: `TOKEN_ENCRYPTION_KEY`, falling back to `JWT_SECRET`; changing the key disconnects everyone). Until the credentials are set, the Settings page says so instead of failing.

---

## 7. Running the tests

```bash
npm run test:db:up        # isolated PostgreSQL on port 5433 (data in memory)
npm test                  # Jest backend suite + node:test module suites
npm run test:db:down
```

The test database is rebuilt from the **same Prisma migrations** as production at the start of every run. The suite includes a parser test over the real college workbook and an import test into PostgreSQL.

| Suite | Covers |
| :--- | :--- |
| `tests/backend/*.test.js` (Jest) | auth, hardening, access control, timetable API, versions, notifications, calendar, adaptive rescheduling, academic data, importer, performance |
| `tests/backend/unit/*` | validators, tokens, config, calendar events, the workbook parser |
| `tests/*.test.js` (node:test) | constraints, impact analysis, alternatives, student-day scoring, AI assistant modules |
| `testcases/<name>/` | the test cases of each team member's test document, one folder per person (`rishank`, `rayna`, `rohit`, `raghav`): `npm run test:rishank` / `test:rayna` / `test:rohit` / `test:raghav`, or `npm run test:testcases` for a PASS/FAIL line per case. Each folder's README also lists how to perform the case by hand in the app. |

> **TC20 (100 concurrent users, p95 < 500 ms)** is hardware sensitive: it passes on a quiet machine and can exceed the limit when the machine is busy.

---

## 8. Backend structure

```
server.js                         Entry point: connect, seed time slots, listen
prisma/                           schema.prisma + migrations
data/                             The college workbook(s)
scripts/import-timetable.js       CLI behind "npm run db:import"
src/app.js                        Express app (helmet, CORS, routes, error handling)
src/container.js                  Wires repositories and services together
src/config/                       Environment configuration
src/db/                           Pool + Prisma client, transactions, error translation, seeding
src/importer/                     Workbook reader, parser (pure) and import service
src/repositories/                 Prisma data access, one file per table group
src/auth/                         Password, token, rate limiter, auth service, middleware
src/timetable/ notifications/ calendar/   Services
src/adaptive/                     Disruptions, impact analysis, alternatives, approval, versions
src/scheduling/                   Constraint model, engine, quality evaluator, generation service
src/routes/                       Thin HTTP layer, one router per area
public/                           Frontend (sign-in screen, timetable grid, dashboards)
```

Layering: **routes** parse HTTP, **services** hold business rules, **repositories** hold queries. The scheduling and rescheduling algorithms are pure functions that receive their data; only the services talk to the database.

---

## 9. Key System APIs

All endpoints need a bearer token except `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/academic/sections` (for the sign-up form) and `GET /api/health`.

### Authentication
- `POST /api/auth/register` · `POST /api/auth/login` · `GET /api/auth/me`
- `POST /api/auth/change-password` — revokes older tokens, returns a fresh one
- `POST /api/auth/logout-all` — sign out of every device

### Timetable
- `GET /api/timetables?section=&day=` — active timetable (students: own section only; combined classes included)
- `POST /api/timetables` · `GET/POST /api/timetables/versions` — administrators
- `GET /api/rescheduling/versions` — active timetable scoped to the caller (administrators: history + dashboard metrics)
- `POST /api/admin/timetables/generate` → draft · `POST /api/admin/timetables/drafts/:id/publish` · `DELETE /api/admin/timetables/drafts/:id`

### Adaptive rescheduling (administrators)
- `POST/GET /api/rescheduling/disruptions` · `POST …/:id/analyze`
- `POST /api/rescheduling/generate-alternatives` → ranked options, each resolving **all** affected classes
- `POST /api/rescheduling/approve` `{ disruptionId, alternativeId }` · `POST /api/rescheduling/versions/:id/rollback`
- `POST /api/ai/interpret | validate | explain`

### Academic data, notifications, calendar, health
- `GET /api/academic/{subjects,faculty,rooms,sections,time-slots,blocks}` · `POST/DELETE` for administrators
- `GET /api/notifications` · `PATCH /api/notifications/:id/read` · `POST /api/notifications/read-all`
- `GET /api/calendar/events|status` · `POST /api/calendar/sync`
- `GET /api/health` — `200` with API and database `UP`, or `503` with database `DOWN`

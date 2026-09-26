# ReachInbox Email Job Scheduler

A production-grade, distributed Full-Stack Email Job Scheduler service and dashboard built with **TypeScript**, **Express.js**, **BullMQ**, **Redis**, **PostgreSQL (Prisma)**, and **React (Tailwind CSS)**.

The system accepts email scheduling requests via a typed REST API, persists state durably in PostgreSQL, schedules jobs across customizable time intervals and hourly rate limits using **BullMQ delayed jobs (strictly zero cron)**, executes sends via **Ethereal SMTP**, and **survives complete backend/worker process restarts** without lost or duplicated sends.

> 🌐 **Live Deployed App**: [https://reachinbox-email-scheduler-production-0f19.up.railway.app](https://reachinbox-email-scheduler-production-0f19.up.railway.app)  
> 👥 **Reviewers**: `Mitrajit`, `Yadav036` (Access granted)  
> 🔑 **Evaluation Access / Login Credentials**:
> - **Google OAuth**: Click **"Login with Google"** to authenticate via your Google account.
> - **Direct Email Login**: Enter any email address (e.g. `oliver.brown@domain.io` or `evaluator@reachinbox.ai`) and password (e.g. `password123`) to immediately open an authenticated session.

---

## Architecture Overview

```mermaid
flowchart TD
    Client["React Frontend (Vite + Tailwind)"] -->|"REST API / JSON"| Express["Express API Server"]
    Express -->|"1. Persist Email Record (SCHEDULED)"| Postgres[("PostgreSQL\n(Durable Source of Truth)")]
    Express -->|"2. Enqueue Delayed Job (jobId: email.id)"| BullMQQueue["BullMQ Email Queue"]
    BullMQQueue -->|"Job Data & Timers"| Redis[("Redis AOF Persistent Store")]
    
    subgraph Workers ["Distributed Worker Engine"]
      W1["BullMQ Worker #1"]
      W2["BullMQ Worker #2"]
      WN["BullMQ Worker #N"]
    end
    
    Redis -->|"Promote delayed job upon expiry"| Workers
    Workers -->|"3. Atomic Claim: SCHEDULED -> PROCESSING"| Postgres
    Workers -->|"4. Atomic Lua Rate Limit Check & Slot Increment"| Redis
    Workers -->|"5. Send Message (STARTTLS)"| Ethereal["Ethereal SMTP Provider"]
    Workers -->|"6. Finalize Status: PROCESSING -> SENT"| Postgres
```

### Component Responsibilities

1. **React Frontend (`frontend/`)**:
   - Modern dashboard matching Figma aesthetics with zero third-party component bloat.
   - Provides Google OAuth login, user profile headers with avatar, and session management.
   - Dual-tab view: **Scheduled Emails** (with live polling) and **Sent Emails** (with delivery timestamps & attempt counts).
   - "Compose New Email" modal supporting CSV/text lead upload with automated header detection, deduplication, valid address badge counts, custom start times, per-email delay intervals, and hourly rate limits.

2. **Express API Server (`backend/src/api/`)**:
   - Validates all request payloads using strict **Zod** schemas.
   - Generates deterministic UUIDs for email records and performs single-roundtrip bulk insertion into PostgreSQL.
   - Pipelined enqueueing into BullMQ using `queue.addBulk()` with deterministic job IDs (`jobId: email.id`), ensuring instant response times even when scheduling **1,000+ emails at once** (<400ms).
   - Serves authenticated endpoints guarded by JWT session cookies or Bearer tokens.

3. **PostgreSQL Database (`backend/prisma/`)**:
   - Durable, relational source of truth.
   - Maintains transactional records for users and emails across states: `SCHEDULED`, `PROCESSING`, `SENT`, and `FAILED`.
   - Indexed on `[userId]`, `[status]`, `[scheduledAt]`, `[recipient]`, `[sender]`, and composite `[status, scheduledAt]` for fast dashboard queries and monitoring.

4. **Redis Persistent Store (`docker-compose.yml`)**:
   - Backed by **Append-Only File (`--appendonly yes`)** persistence to guarantee scheduled jobs and rate limits survive hardware or process restarts.
   - Powers BullMQ delayed job sorted sets and Redis atomic sliding counters.

5. **BullMQ Workers (`backend/src/queue/worker.ts`)**:
   - Configurable concurrency (`WORKER_CONCURRENCY`, default `5`).
   - Executes atomic state transition claims (`SCHEDULED -> PROCESSING`) to prevent concurrent race conditions across multiple workers.
   - Enforces Redis-backed hourly rate limiting.
   - On rate limit violation: **never drops or fails emails**; reschedules them into the next UTC hour window.
   - Dispatches delivery via Ethereal SMTP and transitions database records to `SENT`.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Backend** | Node.js (v24), TypeScript, Express.js, Prisma ORM, BullMQ, ioredis, Nodemailer, Zod, JWT |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, Lucide React, Axios |
| **Infrastructure** | Docker Compose, PostgreSQL 16 (Alpine), Redis 7 (Alpine with AOF) |
| **Testing** | Vitest, Supertest, Docker integration suites |

---

## Repository Structure

```
reachinbox-scheduler/
├── docker-compose.yml          # PostgreSQL (port 5434) + Redis AOF (port 6379)
├── package.json                # Root monorepo workspace configuration
├── README.md                   # Complete architectural and operational guide
├── TESTING.md                  # Comprehensive test checklist & verification report
├── DEMO_SCRIPT.md              # 5-minute video demo script & step-by-step guide
├── ASSIGNMENT_CHECKLIST.md     # Detailed requirement verification matrix
├── INTERVIEW_QA.md             # 30+ deep architectural questions & answers
├── FINAL_REPORT.md             # Engineering sign-off and audit report
├── .gitignore                  # Clean exclusion of secrets, volumes, and builds
│
├── backend/
│   ├── prisma/
│   │   └── schema.prisma       # User & Email models with atomic status enums
│   ├── src/
│   │   ├── api/                # Express route controllers (/auth, /emails)
│   │   ├── config/             # Zod-validated environment config
│   │   ├── db/                 # Singleton Prisma client
│   │   ├── middleware/         # Auth guard & Zod validation middlewares
│   │   ├── queue/              # BullMQ queue configuration and worker logic
│   │   ├── rateLimiter/        # Redis-backed atomic Lua hourly rate limiter
│   │   ├── services/           # Ethereal email sender and batch scheduler
│   │   ├── types/              # Domain interfaces and API DTOs
│   │   ├── utils/              # Structured logger
│   │   ├── __tests__/          # 14 automated integration & restart tests
│   │   ├── index.ts            # Server entry point
│   │   └── worker.ts           # Standalone worker process entry point
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
└── frontend/
    ├── src/
    │   ├── components/         # Header, EmailTable, ComposeModal, LoginView
    │   ├── lib/                # Typed Axios API client & CSV lead parser
    │   ├── types/              # Frontend TypeScript models
    │   ├── App.tsx             # Main dashboard controller with live polling
    │   └── main.tsx            # React root
    ├── package.json
    ├── tailwind.config.js
    └── vite.config.ts
```

---

## Getting Started

### Prerequisites
- **Node.js**: v20+ (tested on Node v24.15.0)
- **npm**: v10+ (tested on npm 11.11.0)
- **Docker & Docker Compose**: (tested on Docker Engine 29.3.0)

---

### Step 1: Start Infrastructure (PostgreSQL & Redis)

Start the containerized PostgreSQL and Redis instances:

```bash
docker compose up -d
```

Verify that both containers are healthy:
```bash
docker compose ps
```
*Note: To avoid port collisions with any local PostgreSQL service on default port 5432, Docker maps PostgreSQL to host port `5434` (`5434:5432`). Redis is mapped to standard port `6379`.*

---

### Step 2: Configure Environment Variables

The repository includes a pre-configured `.env` file in `backend/`. For reference, `backend/.env.example` contains:

```env
PORT=5000
NODE_ENV=development

# Database (PostgreSQL on host port 5434)
DATABASE_URL="postgresql://postgres:postgres@localhost:5434/reachinbox_scheduler?schema=public"

# Redis (BullMQ & Rate Limiter on host port 6379)
REDIS_HOST=localhost
REDIS_PORT=6379

# Worker Configuration
WORKER_CONCURRENCY=5
DEFAULT_HOURLY_LIMIT=100

# Authentication
JWT_SECRET=supersecret_reachinbox_jwt_token_change_in_production
FRONTEND_URL=http://localhost:5173

# Google OAuth (Optional for evaluation; dev-login available)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# SMTP / Ethereal Email (Auto-provisioned or configured)
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=q4qhpaczettgxf3x@ethereal.email
SMTP_PASS=KaPzNwS44cMUMX41mU
SMTP_SECURE=false
SMTP_FROM="ReachInbox Scheduler <scheduler@reachinbox.ai>"
```

---

### Step 3: Run Database Migrations

Apply the Prisma migrations to generate the database schema and TypeScript client:

```bash
cd backend
npx prisma migrate dev --name init
cd ..
```

---

### Step 4: Run the Application

You can launch both the backend API (with integrated BullMQ worker) and the frontend Vite development server concurrently from the monorepo root:

```bash
# In the project root:
npm install

# Start both services:
npm run dev:backend   # Terminal 1: Backend on http://localhost:5000
npm run dev:frontend  # Terminal 2: Frontend on http://localhost:5173
```

Alternatively, to run the worker in an isolated dedicated process:
```bash
# Terminal 1: Backend API only
RUN_WORKER=false npm run dev:backend

# Terminal 2: Standalone Worker process
npm run dev:worker
```

Open your browser to: **`http://localhost:5173`**

---

## Core Architecture Decisions

### 1. No Cron Constraint
- **Why Cron is Forbidden**: Cron jobs require periodic polling loops (e.g. `SELECT * FROM emails WHERE scheduledAt <= NOW()`). Polling loops create race conditions across multiple worker instances, introduce database load spikes ("thundering herd"), and introduce latency jitter between polling ticks.
- **Our Solution**: Pure **BullMQ Delayed Jobs**. BullMQ maintains delayed jobs in a Redis sorted set (`ZSET`) keyed by epoch timestamp. Redis automatically manages expiration, and BullMQ atomically moves due jobs into the active waiting stream without any database polling loop.

### 2. Idempotency & Concurrency Guard
- **The Challenge**: In high-concurrency environments, multiple workers can attempt to process the exact same scheduled email simultaneously.
- **Deterministic Job ID**: Every BullMQ job uses `jobId = email.id`. BullMQ naturally rejects duplicate enqueue attempts for the same email ID.
- **Atomic DB Claim**: Before sending, the worker performs an atomic SQL conditional update:
  ```ts
  const claim = await db.email.updateMany({
    where: {
      id: emailId,
      status: EmailStatus.SCHEDULED,
    },
    data: {
      status: EmailStatus.PROCESSING,
      attempts: { increment: 1 },
    },
  });

  if (claim.count === 0) {
    // Another worker already claimed or finalized this record; abort immediately.
    return;
  }
  ```
- **Crash Window Trade-Off**: In any distributed architecture where an external SMTP send is decoupled from a relational database, there is an unavoidable theoretical crash window:
  ```
  SMTP Send Succeeds -> Worker Process Dies -> DB Status Update to 'SENT' Fails
  ```
  We document this honestly: No database-only status check can provide mathematical exactly-once guarantees against external side-effects across arbitrary power cuts. To mitigate this in practice:
  1. Status is atomically updated to `PROCESSING` beforehand.
  2. Workers enforce `attempts` limits.
  3. Already `SENT` records are permanently rejected from duplicate re-sending.

### 3. Distributed Redis Rate Limiting
- **Shared Across Workers**: Rate limit state is **never** held in local Node.js process memory. It resides in Redis using keys scoped to sender and UTC hour window:
  `rate:{sender}:{YYYY-MM-DDTHH}`
- **Atomic Lua Script**: Checking and incrementing is executed as a single atomic Lua script:
  ```lua
  local current = redis.call('GET', KEYS[1])
  if current and tonumber(current) >= tonumber(ARGV[1]) then
    return {0, tonumber(current)} -- Rejected: limit hit
  else
    local val = redis.call('INCR', KEYS[1])
    if val == 1 then
      redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
    end
    return {1, val} -- Allowed: new count
  end
  ```
- **Reschedule on Limit Hit**: If an email exceeds the sender's hourly limit:
  1. The email is **never** dropped or marked as failed.
  2. Its database `scheduledAt` is updated to the start of the next hour window.
  3. A new delayed BullMQ job is enqueued for `Date.now() + msUntilNextHour`.

### 4. Restart Persistence
- **Redis AOF**: Redis is configured with `--appendonly yes`, ensuring delayed job timers survive container or host reboots.
- **PostgreSQL Source of Truth**: Email state and metadata live durably in PostgreSQL.
- **Verification**: Our test suite includes a verified restart test (`src/__tests__/restart.test.ts`) that schedules a delayed email, shuts down all active workers, halts execution, starts a new worker, and confirms the email sends exactly when due.

### 5. 1,000+ Email Batch Scalability
- **Bulk Database Insertion**: Pre-generates UUIDs and calls `db.email.createMany()` in a single SQL insert statement.
- **Pipelined Queue Enqueueing**: Calls `emailQueue.addBulk()` in chunks of 500 in single Redis pipeline roundtrips.
- **Result**: Scheduling 1,000 emails completes and returns an HTTP 201 response in **under 400 milliseconds**.

---

## API Documentation

### Authentication Endpoints
- `GET /api/auth/google`: Initiates Google OAuth 2.0 flow.
- `GET /api/auth/google/callback`: OAuth callback handler, sets session JWT cookie.
- `GET /api/auth/me`: Returns current authenticated user profile (`id`, `name`, `email`, `avatarUrl`).
- `POST /api/auth/logout`: Clears session cookie.
- `POST /api/auth/dev-login`: Quick development login for testing (`{ email, name }`).

### Scheduling & Email Endpoints
- `POST /api/emails/schedule`: Enqueues an email campaign batch.
  ```json
  {
    "sender": "outreach@company.com",
    "subject": "Q4 Partnership Proposal",
    "body": "<p>Hello,</p><p>We would love to connect...</p>",
    "recipients": ["lead1@client.com", "lead2@client.com"],
    "startTime": "2026-09-24T18:00:00.000Z",
    "delayBetweenEmails": 5000,
    "hourlyLimit": 50
  }
  ```
- `GET /api/emails/scheduled?page=1&pageSize=20`: Lists pending and processing emails.
- `GET /api/emails/sent?page=1&pageSize=20`: Lists delivered and failed emails with attempts and delivery timestamps.
- `GET /api/emails/:id`: Fetches a single email record by ID.
- `GET /health`: Healthcheck verifying PostgreSQL and Redis connections (`200 OK`).

---

## Automated Test Suites

Run the complete test suite across both packages from the monorepo root:

```bash
# Run all 19 integration and unit tests
npm test

# Run backend tests only (14 tests)
npm run test:backend

# Run frontend tests only (5 tests)
npm run test:frontend

# Run full TypeScript typecheck
npm run typecheck
```



---

## Known Assumptions & Trade-Offs

1. **Ethereal Email vs. Production SMTP**:
   Ethereal Email is used as the fake SMTP sink as requested. Ethereal captures all sent emails and exposes web preview URLs for inspection (`https://ethereal.email/message/...`) without emailing real inboxes.
2. **Crash Window Mitigation**:
   As documented in our Idempotency section, distributed systems sending external side-effects (SMTP) cannot achieve mathematical exactly-once delivery without provider-level idempotency keys. Our atomic claim pattern guarantees at-most-once concurrent processing and prevents duplicate internal worker execution.
3. **UTC Window Granularity**:
   Hourly rate limits are keyed by discrete UTC hour buckets (`rate:{sender}:YYYY-MM-DDTHH`). This provides atomic, deterministic bucket boundaries with clean `EXPIRE` garbage collection in Redis.

---


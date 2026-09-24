# ReachInbox Email Scheduler — Testing & Verification Guide

This document records the exact test plan, automated test results, and step-by-step manual verification procedures.

---

## 1. Verification Checklist

| Test Item | Verification Type | Status | Evidence / Notes |
|---|---|---|---|
| **Docker starts** | Automated & Manual | **PASSED** | PostgreSQL and Redis containers healthy via `docker compose ps` |
| **PostgreSQL connects** | Automated | **PASSED** | Verified via Prisma migration & `/health` endpoint returning `healthy` |
| **Redis connects** | Automated | **PASSED** | Verified via BullMQ queue ping & `/health` endpoint returning `healthy` |
| **Backend starts** | Automated & Manual | **PASSED** | Express server listens on port 5000, routes mounted |
| **Worker starts** | Automated | **PASSED** | BullMQ Worker initialized with configurable concurrency |
| **Frontend starts** | Automated & Manual | **PASSED** | Vite dev server / production bundle builds in 1.66s |
| **Google login works** | Manual & Integration | **PASSED** | Real OAuth 2.0 flow via Google Auth Library + Dev login fallback |
| **Logout works** | Automated & Manual | **PASSED** | Clears session cookie via `POST /api/auth/logout` |
| **Compose works** | Automated & Manual | **PASSED** | Modal captures subject, body, sender, delay, and rate limits |
| **CSV parsing works** | Automated | **PASSED** | `csvParser.test.ts` (5/5 passed) verifies header skipping & stats |
| **Scheduled tab works** | Automated & Manual | **PASSED** | `GET /api/emails/scheduled` renders pending jobs with status badges |
| **Sent tab works** | Automated & Manual | **PASSED** | `GET /api/emails/sent` renders delivered jobs with timestamps & attempts |
| **Email sent via Ethereal** | Automated | **PASSED** | Verified real delivery in `worker.test.ts` with preview URL |
| **Delay works** | Automated | **PASSED** | BullMQ delayed job timers stagger sends (`opts.delay`) |
| **Hourly limit works** | Automated | **PASSED** | `rateLimiter.test.ts` verifies atomic Redis Lua cap and rescheduling |
| **Multiple workers work** | Automated | **PASSED** | `WORKER_CONCURRENCY=5` tested across concurrent queues |
| **Duplicate job prevention**| Automated | **PASSED** | Atomic claim `WHERE status = 'SCHEDULED'` blocks duplicate worker sends |
| **Restart scenario works** | Automated | **PASSED** | `restart.test.ts` proves jobs survive complete worker process downtime |
| **1000+ batch non-blocking** | Automated | **PASSED** | 1000 emails scheduled in **323ms** without blocking HTTP response |
| **Error states work** | Automated & Manual | **PASSED** | Zod validation rejects bad email formats & empty bodies with 400 |

---

## 2. Automated Test Suite Results

Run from the root directory:
```bash
npm test
```

### Exact Terminal Output
```
> reachinbox-scheduler-backend@1.0.0 test
> vitest run

 ✓ src/__tests__/rateLimiter.test.ts (4 tests) 43ms
 ✓ src/__tests__/worker.test.ts (3 tests) 4382ms
 ✓ src/__tests__/api.test.ts (6 tests) 971ms
 ✓ src/__tests__/restart.test.ts (1 test) 9195ms

 Test Files  4 passed (4)
      Tests  14 passed (14)
   Duration  19.62s

> frontend@0.0.0 test
> vitest run

 ✓ src/lib/csvParser.test.ts (5 tests) 9ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Duration  1.50s

Total: 19 passed across 5 test suites.
```

---

## 3. Step-by-Step Manual Verification Walkthrough

### Test A: Verify Infrastructure & Health
1. Start containers:
   ```bash
   docker compose up -d
   ```
2. Verify container statuses:
   ```bash
   docker compose ps
   ```
   Both `reachinbox-postgres` (port 5434) and `reachinbox-redis` (port 6379) must show `healthy`.
3. Check application health endpoint:
   ```bash
   curl http://localhost:5000/health
   ```
   Expected response:
   ```json
   {
     "status": "healthy",
     "services": {
       "database": "healthy",
       "redis": "healthy"
     }
   }
   ```

---

### Test B: Compose & CSV Upload Verification
1. Open the dashboard at `http://localhost:5173`.
2. Click **"Compose New Email"**.
3. Create a test CSV file `leads.csv`:
   ```csv
   email,name
   alex@example.com,Alex
   invalid-email-address,BadRow
   sarah@company.io,Sarah
   alex@example.com,DuplicateAlex
   ```
4. Click **"Upload CSV / TXT"** and select `leads.csv`.
5. Observe the address indicator badge:
   - Displays: `✓ 2 valid addresses detected`
   - Displays: `1 invalid rows ignored`
   - Notice duplicate `alex@example.com` is automatically deduplicated.
6. Set Start Time to **2 minutes in the future**.
7. Set Delay between emails to **3 seconds**.
8. Set Hourly Limit to **50**.
9. Click **"Schedule Batch"**.
10. Confirm the success toast notification appears: `"Successfully enqueued 2 email(s) into BullMQ delayed queue"`.

---

### Test C: Scheduled Tab & Live Worker Execution
1. Navigate to the **"Scheduled Emails"** tab.
2. Confirm the 2 newly scheduled email records appear with the `Scheduled` (sky blue) status badge.
3. Wait for the scheduled start time to arrive.
4. Watch the table update automatically (via the 4s live polling loop):
   - Status momentarily transitions to `Processing` (amber).
   - Once dispatched through Ethereal, the rows disappear from the Scheduled tab.
5. Switch to the **"Sent Emails"** tab:
   - Both emails are now listed with the `Sent` (emerald green) badge.
   - Shows the exact delivery timestamp and `Attempts: 1`.

---

### Test D: Server Restart Persistence Verification (Mandatory Demo Requirement)
1. In the Compose modal, schedule 1 email with a Start Time **60 seconds into the future**.
2. Verify the email appears in the **Scheduled Emails** tab.
3. In your terminal, stop the backend/worker process:
   ```bash
   # Press Ctrl+C in the backend terminal
   ```
4. Notice that during server downtime, the scheduled job remains safely stored in Redis's Append-Only File (AOF) and in PostgreSQL.
5. Wait 20 seconds while the server is down.
6. Restart the backend:
   ```bash
   npm run dev:backend
   ```
7. When the 60-second timer expires:
   - The restarted BullMQ worker picks up the job from Redis.
   - The email is transmitted to Ethereal SMTP.
   - The database status transitions to `SENT`.
8. Check the **Sent Emails** tab: The email appears with `Attempts: 1` and status `Sent`!

---

### Test E: Hourly Rate Limit & Rescheduling Verification
1. Schedule a batch of 4 emails with `hourlyLimit = 3`.
2. The worker processes Email 1, 2, and 3 successfully in the current hour window.
3. Upon reaching Email 4:
   - Worker checks Redis atomic Lua limiter: `currentCount (3) >= limit (3)`.
   - Email 4 is **NOT** failed or dropped.
   - Worker logs: `[WARN] Hourly limit (3) reached for sender. Rescheduling into next hour window.`
   - In PostgreSQL, Email 4's `scheduledAt` is updated to the next hour, and status remains `SCHEDULED`.

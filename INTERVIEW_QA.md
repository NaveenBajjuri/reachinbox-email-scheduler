# ReachInbox Email Scheduler — Technical Interview Q&A

This document contains in-depth, production-grounded answers to 30 technical questions regarding the architecture, trade-offs, and implementation of this system.

---

### 1. Why BullMQ?
BullMQ is a battle-tested distributed queue engine built specifically on top of Redis. It provides native delayed job capabilities, atomic job state transitions via Lua scripts, automatic retries with exponential backoffs, and worker concurrency controls. Instead of rolling custom queue logic, BullMQ abstracts distributed lock management and worker heartbeats cleanly.

---

### 2. Why Redis?
Redis is an in-memory data store with sub-millisecond read/write speeds, rich data structures (such as Sorted Sets `ZSET` and Streams), and single-threaded execution of commands and Lua scripts. This makes Redis ideal for high-throughput queuing, atomic sliding-window rate limiters, and delayed job coordination where locking overhead must be minimal.

---

### 3. Why PostgreSQL?
PostgreSQL serves as our durable, ACID-compliant relational source of truth. While Redis holds transient queue state and timers, PostgreSQL durably stores email bodies, recipient lists, user accounts, and historical logs. If Redis were flushed or evacuated, PostgreSQL maintains the full immutable audit trail.

---

### 4. Why not cron?
Cron jobs operate on discrete polling intervals (e.g., every minute) scanning a database table: `SELECT * FROM emails WHERE scheduledAt <= NOW()`. This architecture exhibits three major flaws:
1. **Thundering Herd / Lock Contention**: Every worker queries the same table at the exact same minute boundary.
2. **Polling Latency**: Emails scheduled for `12:00:01` have to wait until `12:01:00` for the next tick.
3. **Race Conditions**: Two cron runners can pick up the same row unless pessimistic locking (`FOR UPDATE SKIP LOCKED`) is carefully managed.
BullMQ delayed jobs eliminate polling entirely by scheduling jobs into Redis sorted sets where jobs are promoted instantaneously upon timer expiration.

---

### 5. How do delayed jobs work?
When an email is scheduled for the future, we calculate `delay = targetSendTime - Date.now()`. BullMQ stores the job in a Redis Sorted Set (`ZSET`) where the `score` is the Unix epoch timestamp when the job becomes due. BullMQ workers run a light event-driven loop that inspects the head of the sorted set; as soon as `score <= currentTimestamp`, Redis atomically moves the job into the `wait` stream for workers to consume.

---

### 6. What happens after restart?
Because Redis is configured with Append-Only File (`--appendonly yes`) persistence, all delayed job records in Redis survive container, process, or server reboots. When the server or worker restarts:
1. The worker connects to Redis and re-subscribes to the BullMQ queue stream.
2. Future delayed jobs remain in the sorted set with their original timestamps intact.
3. Jobs that expired during the downtime are immediately promoted to the `wait` stream and processed sequentially.
4. Database status remains `SCHEDULED` until claimed.

---

### 7. What is idempotency?
Idempotency means that executing the same operation multiple times yields the exact same side-effect and outcome as executing it once. In our email scheduler, enqueuing or running a job multiple times must never cause more than one physical email to be delivered to the recipient's inbox.

---

### 8. How can duplicate sends occur?
Duplicate sends can happen if:
1. The user double-submits the compose form.
2. Network timeout causes the HTTP client to retry a batch submission.
3. Two worker threads dequeue the same job concurrently.
4. A worker crashes immediately after dispatching the email via SMTP but before writing `SENT` to the database, causing a queue retry.

---

### 9. What race conditions exist?
In a multi-worker environment, Worker A and Worker B might both attempt to fetch and process email record `XYZ` at the same microsecond. If both workers check `if (email.status === 'SCHEDULED')` simultaneously, both checks evaluate to `true`, leading both workers to call SMTP.

---

### 10. How does your atomic status transition work?
We prevent race conditions using an atomic conditional update in PostgreSQL:
```sql
UPDATE "Email"
SET "status" = 'PROCESSING', "attempts" = "attempts" + 1
WHERE "id" = :emailId AND "status" = 'SCHEDULED';
```
In Prisma, this is executed as:
```ts
const claim = await db.email.updateMany({
  where: { id: emailId, status: EmailStatus.SCHEDULED },
  data: { status: EmailStatus.PROCESSING, attempts: { increment: 1 } },
});
```
Because PostgreSQL acquires an exclusive row-level lock during the update, only one worker receives `claim.count === 1`. Any other concurrent worker receives `claim.count === 0` and immediately aborts execution.

---

### 11. How does rate limiting work?
We enforce an hourly send cap per sender using Redis keys formatted as:
`rate:{sender}:{YYYY-MM-DDTHH}`
Every send attempt executes an atomic Lua script that reads the key, checks if `current < limit`, increments and sets TTL if allowed, or returns `0` (denied). If denied, the email is automatically rescheduled to the start of the next hour window rather than dropped.

---

### 12. Why Redis-backed rate limiting?
In-memory counters (e.g. `let count = 0`) only live inside a single Node.js process. When multiple worker threads or clustered instances run, local counters cannot see each other's traffic, allowing aggregate throughput to breach provider rate limits. A centralized Redis key provides a single source of truth across all workers.

---

### 13. How does concurrency work?
Worker concurrency defines how many jobs a single worker process pulls and processes in parallel (configured via `WORKER_CONCURRENCY=5`). While one worker thread awaits network I/O from the SMTP server (e.g. 500ms network latency), Node's event loop executes other email jobs in parallel, multiplying throughput without blocking.

---

### 14. What happens with 1,000+ emails?
If 1,000 emails are submitted simultaneously:
1. Pre-generated UUIDs are batched and inserted into PostgreSQL using `db.email.createMany()` in a single query.
2. BullMQ jobs are enqueued in Redis using `queue.addBulk()` in 500-item chunks.
3. The API responds with HTTP 201 in under 400 milliseconds.
4. Workers pick up jobs according to their concurrency limits and inter-email delays, smoothing out the load.

---

### 15. Why Ethereal?
Ethereal Email is a hosted fake SMTP sandbox designed by the creator of Nodemailer. It accepts real SMTP connections using authentic STARTTLS protocols, but instead of routing emails to real inboxes (which could trigger spam filters or deliver unwanted test emails), it captures the messages and generates shareable web preview URLs.

---

### 16. How does Google OAuth work?
1. The user clicks "Continue with Google", redirecting to Google's OAuth 2.0 authorization server with scopes `userinfo.profile` and `userinfo.email`.
2. Upon user consent, Google redirects to `/api/auth/google/callback` with a one-time authorization code.
3. The backend server exchanges this code for Google access and ID tokens via `google-auth-library`.
4. The server validates the cryptographic signature of the ID token, upserts the user in PostgreSQL, signs a JWT session cookie (`httpOnly`), and redirects to `/dashboard`.

---

### 17. Why use Prisma?
Prisma provides type-safe database queries synchronized with our database schema. It handles migrations, foreign key constraints, connection pooling, and prevents SQL injection vulnerabilities by default through parameterized queries.

---

### 18. Why TypeScript?
TypeScript guarantees end-to-end type consistency across the API contracts, queue payloads, database entities, and React components. A change to an email status or payload field is caught at compile-time (`npm run typecheck`), preventing runtime errors in production.

---

### 19. What happens when SMTP fails?
If the SMTP handshake or transmission fails:
1. Nodemailer throws an error.
2. The worker catches the error, increments the database `attempts` counter, and updates `errorMessage`.
3. If attempts < 3, the database status reverts to `SCHEDULED`, and BullMQ applies exponential backoff retry.
4. If attempts reach 3, the email is marked as `FAILED` with the full error trace persisted for user inspection.

---

### 20. How are retries handled?
BullMQ is configured with default retry options:
```ts
{
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000,
  }
}
```
If an intermittent network failure occurs, BullMQ automatically delays the retry by 5s, 10s, and 20s.

---

### 21. What are your system's limitations?
1. **SMTP Crash Window**: An external crash occurring between successful SMTP receipt and database commit can cause an email re-send on recovery unless the SMTP server supports idempotency keys.
2. **Redis Memory Overhead**: BullMQ keeps job metadata in Redis memory. If millions of completed jobs are retained without cleanup policies (`removeOnComplete`), Redis RAM usage will grow.
3. **Single Redis Instance**: In our Docker setup, Redis is a standalone container rather than a Redis Sentinel or Redis Cluster.

---

### 22. How would you scale this production system?
1. **Decouple API and Workers**: Deploy API containers behind an Application Load Balancer (ALB) and deploy Worker containers as autoscaling groups (HPA) scaling on Redis queue depth (`bull:email-queue:wait`).
2. **Read/Write DB Splitting**: Direct dashboard read queries (`GET /scheduled`, `GET /sent`) to PostgreSQL read replicas.
3. **Redis Cluster / Sentinel**: Use a replicated Redis deployment with automatic failover.

---

### 23. How would you handle millions of emails?
1. **Partitioning**: Partition the PostgreSQL `Email` table by month or tenant ID.
2. **Multi-Queue Routing**: Divide queues by priority (`email-queue-high`, `email-queue-bulk`).
3. **Tiered Workers**: Dedicate specific worker pools to specific high-volume senders so large batch campaigns do not starve transactional emails.

---

### 24. How would you implement provider-level idempotency?
Send an `Idempotency-Key` or custom `Message-ID` header (e.g. `reachinbox-{email.id}`) in the SMTP payload. Advanced email providers (like SendGrid, Mailgun, or AWS SES) de-duplicate incoming messages with identical IDs within a 24-hour window, preventing duplicate delivery even during network replay.

---

### 25. What happens if Redis goes down?
If Redis is unreachable:
1. The `/health` endpoint reports `redis: "unhealthy"` with HTTP 503.
2. The API fails fast on scheduling requests rather than silently dropping them.
3. PostgreSQL records remain safe.
4. When Redis restarts, its AOF file restores all pending delayed jobs.

---

### 26. What happens if PostgreSQL goes down?
If PostgreSQL crashes:
1. Workers cannot claim records (`claim.count === 0` or connection error).
2. Workers fail the job and let BullMQ back off until the database reconnects.
3. No emails are dispatched blindly without an active database lock.

---

### 27. What happens if a worker crashes?
If a worker crashes mid-execution:
1. BullMQ detects the stalled lock heartbeat (`stalledInterval`).
2. The job is automatically reclaimed and assigned to another active worker.
3. The new worker checks the database status before retrying.

---

### 28. How do you prevent duplicate jobs?
Every BullMQ job is assigned `jobId = email.id`. BullMQ enforces uniqueness on job IDs inside Redis; any secondary attempt to enqueue a job with the same ID is rejected as a duplicate.

---

### 29. How do you handle invalid CSV rows?
The frontend parser (`csvParser.ts`) evaluates each row against RFC email regular expressions, trims surrounding quotes and whitespace, skips recognized header rows, and strips duplicate entries. Any row failing format checks increments `invalidCount` and is safely omitted without crashing the parser.

---

### 30. How would you monitor this in production?
1. **BullMQ Arena / Bull-Board**: Embed a lightweight dashboard to monitor active, waiting, delayed, and failed job counts in real time.
2. **Prometheus & Grafana**: Export worker throughput metrics, queue latency, and rate-limit hits.
3. **Sentry**: Capture unhandled server exceptions and worker failures with full stack traces.

# ReachInbox Email Scheduler — 5-Minute Video Demo Script

This script provides an exact, second-by-second walkthrough for recording your 5-minute Loom or screen capture video for ReachInbox / Outbox Labs evaluators.

---

## Pre-Recording Checklist
- [ ] Docker containers running (`reachinbox-postgres` on port 5434, `reachinbox-redis` on port 6379).
- [ ] Backend running (`npm run dev:backend`).
- [ ] Frontend running (`npm run dev:frontend`).
- [ ] Browser open at `http://localhost:5173`.
- [ ] Terminal window open and visible side-by-side or ready to switch to.
- [ ] Have a small CSV file `leads.csv` on your desktop:
  ```csv
  email,name
  candidate1@example.com,Candidate One
  candidate2@example.com,Candidate Two
  candidate3@example.com,Candidate Three
  ```

---

## Detailed Video Timeline & Script

### 0:00 – 0:25: Introduction & Authentication
- **On Screen**: Browser showing the ReachInbox login page (`http://localhost:5173`).
- **Action**: Explain the project briefly, then click **"Launch Dashboard Session"** (or "Continue with Google").
- **What to Say**:
  > *"Hi everyone, my name is Naveen Bajjuri. This is my submission for the ReachInbox Software Development Intern assignment: a production-grade full-stack email job scheduler.
  > The architecture uses TypeScript, Express, PostgreSQL with Prisma, Redis, BullMQ for delayed job scheduling, and a React Tailwind dashboard.
  > Let's log in to the dashboard."*

---

### 0:25 – 0:45: Dashboard Overview
- **On Screen**: Dashboard layout with user profile header, Scheduled Emails tab, and Sent Emails tab.
- **Action**: Highlight the header (showing user name, email, avatar, and logout button), and show the empty state.
- **What to Say**:
  > *"Here is the main dashboard. In the top navigation, we display the authenticated user's name, email, and avatar with full logout capabilities.
  > The interface features two primary views: 'Scheduled Emails' and 'Sent Emails', complete with empty states, loading skeletons, and real-time polling so queue updates appear dynamically without manual page refreshes."*

---

### 0:45 – 1:30: Compose Email & CSV Lead Upload
- **On Screen**: Click **"Compose New Email"** button; modal opens.
- **Action**:
  1. Fill Subject: `"Welcome to ReachInbox"`.
  2. Fill Body: `"<p>Hi there, we are excited to have you on board!</p>"`.
  3. Click **"Upload CSV / TXT"** and select `leads.csv`.
  4. Point out the detected address count badge: `"3 valid addresses detected"`.
  5. Set Start Time: Choose a time **60 seconds into the future**.
  6. Set Delay: 3 seconds.
  7. Set Hourly Limit: 100.
  8. Click **"Schedule Batch"**.
- **What to Say**:
  > *"Now let's compose a new email batch. I'll enter a subject and body.
  > For recipients, our frontend supports CSV and text uploads. Notice as I upload this CSV, our parser automatically filters headers, strips whitespace, removes duplicates, and immediately displays '3 valid addresses detected'.
  > We can also configure a custom start time, inter-email delay, and an hourly rate limit.
  > Let's schedule this batch 60 seconds into the future with a 3-second delay between emails.
  > When I click Schedule, the API creates database records and enqueues BullMQ delayed jobs in a single bulk operation without blocking the HTTP thread."*

---

### 1:30 – 2:10: Scheduled Tab & Architecture Explanation (No Cron)
- **On Screen**: The **Scheduled Emails** tab showing the 3 newly created emails with `Scheduled` badges.
- **Action**: Show the scheduled times staggered by 3 seconds.
- **What to Say**:
  > *"As you can see in the Scheduled Emails table, the 3 jobs appear immediately with their exact scheduled send times, staggered by 3 seconds.
  > Crucially, our system uses ZERO CRON. We do not use node-cron, OS crontab, Agenda, or continuous database polling loops.
  > Instead, BullMQ stores each job in Redis sorted sets indexed by timestamp. Redis handles timer efficiency, eliminating database polling and thundering herd bottlenecks."*

---

### 2:10 – 3:30: The Restart Scenario (Mandatory Video Requirement)
- **On Screen**: Switch to the terminal window showing the backend server.
- **Action**:
  1. Press `Ctrl + C` in the backend terminal to stop the server while the jobs are still waiting in the queue.
  2. Point out that the server is completely offline.
  3. Wait 10 seconds.
  4. Restart the server with `npm run dev:backend`.
  5. Switch back to the browser and watch the scheduled timer hit.
  6. The status transitions to `Processing`, then sends.
- **What to Say**:
  > *"Now for the core resilience requirement: surviving server restarts.
  > Our 3 jobs are currently waiting in the delayed queue. Right now, I will stop the backend server by pressing Ctrl+C.
  > The server is completely down. In a naive in-memory or cron-based setup, scheduled memory timers would be wiped out.
  > But because our Redis instance runs with Append-Only File (AOF) persistence and BullMQ maintains durable job states, nothing is lost.
  > Let's restart the backend server with `npm run dev:backend`.
  > As the server boots up, the worker seamlessly connects to Redis, recovers the delayed job stream, and as the scheduled time arrives, it picks up and executes each job right on time!"*

---

### 3:30 – 4:15: Sent Tab & Ethereal Delivery Inspection
- **On Screen**: Switch to the **Sent Emails** tab in the dashboard.
- **Action**: Show the 3 delivered emails with `Sent` status badges, delivery timestamps, and attempt counts.
- **What to Say**:
  > *"Switching to the 'Sent Emails' tab, all three emails have now successfully transitioned to SENT status.
  > Each email displays its verified recipient, subject, exact send time, and attempt count.
  > In the backend terminal logs, you can see the Ethereal message IDs and web preview URLs proving real SMTP delivery through Nodemailer."*

---

### 4:15 – 4:45: Idempotency & Rate Limiting Deep-Dive
- **On Screen**: Briefly show `hourlyLimiter.ts` and `worker.ts` in VS Code or summarize with terminal logs.
- **What to Say**:
  > *"Let's talk about our safeguards:
  > First, Idempotency: We enforce atomic status claims in PostgreSQL: `UPDATE Email SET status = 'PROCESSING' WHERE id = :id AND status = 'SCHEDULED'`. If multiple workers pick up the same job, only the worker that claims the row is allowed to send.
  > Second, Distributed Rate Limiting: Rate limit state does not live in Node memory. We use an atomic Redis Lua script scoped to `rate:{sender}:{hourWindow}`. When the limit is reached, the worker never drops or fails the email—it automatically reschedules it into the next hourly window."*

---

### 4:45 – 5:00: Wrap-Up & Summary
- **On Screen**: Back to the browser dashboard.
- **What to Say**:
  > *"All 19 automated integration tests are passing, covering rate limiting, worker idempotency, API performance under 1,000+ batches, and process restarts.
  > Thank you for reviewing my assignment for ReachInbox!"*

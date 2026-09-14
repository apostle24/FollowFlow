# FollowFlow Technical Architecture Document
## Email Scheduling Engine, Persistent Job Queues & Server-Side Execution

**Document Version:** 1.0.0  
**Application:** FollowFlow Real Multi-Channel Delivery System  
**Author:** Google AI Studio Engineering  
**Status:** Architecture Confirmed & Hardened  

---

## 1. Executive Summary

This document reviews and certifies the server-side email scheduling architecture of **FollowFlow**. It confirms the presence and operation of **persistent job queues**, evaluates the temporal precision and edge cases of the `scheduledFor` delivery logic, and details the infrastructure safeguards necessary for dependable execution in serverless container environments (Google Cloud Run / Node.js).

### Architectural Certification:
* **Persistent Job Queue:** **Confirmed & Active**. Scheduled emails are persisted immediately upon receipt to both local atomic storage (`scheduled_emails.json`) and synchronized to Cloud Firestore (`users/{userId}/scheduled_emails/{jobId}`).
* **Server-Side Execution:** **Confirmed & Active**. Scheduling, queuing, retries, and provider dispatches execute strictly within the Node.js backend (`server.ts`). Secret keys (`RESEND_API_KEY`) and dispatch logic are never exposed to the client browser.
* **Resilience:** Built-in mutex locking (`activeJobLocks`), crash recovery for interrupted workers, exponential retry backoff (1m, 5m, 15m), and idempotency deduplication.

---

## 2. Queue Architecture & State Machine

### 2.1 State Transitions

```text
               +-------------------+
               |   POST /schedule  |
               +---------+---------+
                         |
                         v
                  [ pending ]
                         |
       +-----------------+-----------------+
       | (Due: scheduledFor <= now())      |
       v                                   v
[ processing ] (Acquires mutex lock)   [ cancelled ] (User aborted)
       |
       +------------------------------------+
       |                                    |
       v (Success)                          v (Error)
 [ completed / sent ]                 Check attempts < maxAttempts (3)
       |                                    |
       v (Webhook update)           +-------+-------+
 [ delivered / bounced ]            | (Yes)         | (No)
                                    v               v
                               [ pending ]      [ failed ]
                                (Backoff)      (Dead-lettered)
```

### 2.2 Storage & Persistence Strategy

1. **Atomic File Storage (`scheduled_emails.json`)**:
   - Write operations utilize an atomic write-and-rename pattern (`${file}.tmp` -> `fs.renameSync`). This prevents data corruption from sudden container terminations or I/O interrupts.
2. **Dual Cloud Firestore Persistence (`users/{userId}/scheduled_emails/{jobId}`)**:
   - Every scheduled job is also synced to Firestore. This guarantees cross-container durability, surviving Cloud Run scaling events, deploys, and container restarts.
3. **Crash Recovery Algorithm**:
   - On server startup (`loadScheduledJobs()`), any job found in `processing` status is inspected. If a provider message ID or delivery timestamp was recorded, it is marked `completed`. If incomplete, its attempt count is incremented, lock cleared, and re-queued as `pending` to guarantee at-least-once delivery without human intervention.
4. **Concurrency & Stale Lock Protection**:
   - In-memory `activeJobLocks` set prevents duplicate simultaneous dispatches of the same job.
   - Jobs stuck with a lock older than `STALE_LOCK_MS = 300,000ms` (5 minutes) are automatically reclaimed.

---

## 3. Critical Gap Analysis in `scheduledFor` Logic

### Gap 1: UTC vs. Client Local Timezone Mismatch
* **Issue:** When client browsers submit dates like `2026-09-08 14:00` without timezone offsets, the server environment defaults to UTC. A user scheduling for 2:00 PM in New York (EDT, UTC-4) would have had their message dispatched at 2:00 PM UTC (10:00 AM EDT) — 4 hours premature!
* **Remedy Implemented:** 
  1. The API strictly validates ISO-8601 date strings containing explicit timezone designations (`Z` or `+HH:mm` / `-HH:mm`).
  2. All stored dates are normalized immediately via `new Date(scheduledFor).toISOString()` before writing to persistent storage.
  3. The client scheduling interface (`FollowUpForm.tsx`) explicitly converts local selections to UTC ISO strings before dispatch.

### Gap 2: Burst Execution & Provider Rate Limiting (Resend RPS Limits)
* **Issue:** Resend imposes a standard rate limit of **2 requests per second (RPS)**. If a server restarted or a user scheduled a batch of 10 follow-ups for the same minute, the batch processor would iterate rapidly through `dueJobs`, triggering `HTTP 429 Too Many Requests` on later items.
* **Remedy Implemented:**
  - A strict pacing delay (`await new Promise(r => setTimeout(r, 500))`) is enforced in the `processDueScheduledEmails` loop between consecutive dispatches. This caps throughput at 2 RPS, fully compliant with Resend's API quotas.

### Gap 3: Scale-to-Zero Container Suspension in Cloud Run
* **Issue:** In Google Cloud Run and similar container runtimes, CPU is throttled or instances are terminated when no active HTTP requests are in flight. An in-memory `setInterval` cannot trigger if the container is sleeping.
* **Remedy Implemented (Triple-Layer Trigger Architecture):**
  1. **Layer 1 (Internal Loop):** `setInterval` running every 15 seconds while container has active traffic.
  2. **Layer 2 (Passive Middleware Hook):** `app.use('/api', ...)` intercepts any inbound API traffic (e.g. user navigating app, refreshing metrics, or viewing dashboard) and fires `processDueScheduledEmails()` if > 15 seconds have elapsed.
  3. **Layer 3 (External Webhook / Cloud Scheduler):** Dedicated public endpoint `GET/POST /api/scheduler/tick` and `/api/cron/process-emails`, protected by optional `CRON_SECRET`. Google Cloud Scheduler can ping this URL once every minute.

---

## 4. Setup Guide: Cloud Scheduler Setup for 24/7 Precision

To guarantee timely delivery even when no users are logged into the web dashboard:

1. In Google Cloud Console, navigate to **Cloud Scheduler**.
2. Click **Create Job**:
   - **Name:** `followflow-email-scheduler`
   - **Frequency:** `* * * * *` (Every 1 minute)
   - **Timezone:** UTC
   - **Target:** HTTP
   - **URL:** `https://ais-pre-5urnp63gltj5gj7om3ur63-359040680841.europe-west2.run.app/api/scheduler/tick`
   - **HTTP Method:** `POST`
   - **Headers:** `Content-Type: application/json`
3. Click **Save**.

---

## 5. Summary Matrix

| Metric / Capability | FollowFlow Implementation | Verification Status |
| :--- | :--- | :--- |
| **Queue Type** | Persistent Dual-Layer (Local Disk + Firestore) | ✅ Verified |
| **Deduplication** | Idempotency key set + DB lookup | ✅ Verified |
| **Temporal Precision** | ISO-8601 UTC with 15s scan interval | ✅ Verified |
| **Concurrency Control** | Mutex set + 5-min stale lock reclaimer | ✅ Verified |
| **Crash Safety** | Startup state machine with orphaned job recovery | ✅ Verified |
| **Rate Limit Pacing** | 500ms inter-dispatch delay (≤2 RPS) | ✅ Verified |
| **Real Provider Webhook**| Delivery / Bounce tracking (`/api/email/webhook`)| ✅ Verified |

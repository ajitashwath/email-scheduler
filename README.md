# ReachInbox Assignment: Full-Stack Email Job Scheduler

A email scheduling service and dashboard built for the
Outbox Labs hiring assignment. Schedules emails at scale using
BullMQ delayed jobs (no cron), enforces per-sender hourly rate limits with
live Slack notifications, survives restarts without losing or duplicating
jobs, and ships a dashboard that mirrors the provided Figma.

```
email-scheduler/
├── backend/     Express + TypeScript API, BullMQ worker, Prisma/Postgres
└── frontend/    Next.js + TypeScript + MUI dashboard
```


## Prerequisites
- Node.js 20+
- Docker (for Postgres, Redis, Elasticsearch) — or your own local instances
- A Google Cloud project with an OAuth 2.0 Client ID (Web application)
- A Slack app (for the "Connect Slack" rate-limit notification flow)


## Infra: Postgres, Redis, Elasticsearch
```bash
cd backend
docker compose -f docker/docker-compose.yml up -d
```

This starts:
- Postgres on `5432` (db `reachinbox_scheduler`, user/pass `reachinbox`)
- Redis on `6379`
- Elasticsearch (single-node, security disabled for local dev) on `9200`

You can instead point `DATABASE_URL` / `REDIS_HOST` / `ELASTICSEARCH_NODE` in
`.env` at your own instances if you'd rather not use Docker.


## Backend setup
```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev --name init   # creates tables
npx prisma generate
```

### Google OAuth
1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials).
2. Create an **OAuth 2.0 Client ID** (Application type: Web application).
3. Authorized redirect URI: `http://localhost:4000/api/auth/google/callback`
4. Copy the Client ID/Secret into `backend/.env`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```

### Slack OAuth
1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → From scratch.
2. Under **OAuth & Permissions**, add redirect URL:
   `http://localhost:4000/api/slack/callback`
3. Add these **Bot Token Scopes**: `incoming-webhook`, `chat:write`.
4. Install the app to your workspace once (or let the dashboard's "Connect
   Slack" button drive the install — either works).
5. Copy the **Client ID** / **Client Secret** (Basic Information page) into
   `backend/.env`:
   ```
   SLACK_CLIENT_ID=...
   SLACK_CLIENT_SECRET=...
   ```

### Ethereal Email
No signup needed — the backend automatically creates a fresh Ethereal test
SMTP account for every new user on their first Google login (see
`createEtherealTestAccount()` in `src/services/mailService.ts`), and stores
it as their default `Sender`. Sent messages never leave Ethereal's sandbox;
each send's preview URL is logged server-side by nodemailer.

To add extra senders (useful for demoing **per-sender** rate limiting):
```bash
npm run seed:senders -- your-login-email@gmail.com
```

### Run 
You need **two** processes running side by side:
```bash
# Terminal 1 — API server
npm run dev

# Terminal 2 — BullMQ worker (sends the emails)
npm run worker:dev
```
- API: `http://localhost:4000`
- Live BullMQ dashboard: `http://localhost:4000/admin/queues`
  (Basic Auth — user/pass from `BULL_BOARD_USER` / `BULL_BOARD_PASSWORD` in `.env`)

## Frontend setup
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. You'll land on `/login`, which redirects into
the real Google OAuth consent screen. After login you're dropped on
`/dashboard`.


## Architecture overview

### How scheduling works (no cron)
Every recipient in a "Compose" submission becomes one `EmailJob` row in
Postgres (`campaignController.ts` → `schedulerService.ts`). Each row is then
added to a single BullMQ queue (`emailQueue.ts`) as a **delayed job**:

```ts
queue.add("send-email", payload, { jobId: emailJob.id, delay: scheduledFor - now })
```

BullMQ persists delayed jobs in Redis as a sorted set keyed by trigger
timestamp. Redis — not process memory — is what fires the job at the right
time, which is exactly why no OS cron / `node-cron` / polling loop is
needed, and why this survives restarts (see 5.2).

**Per-recipient spacing**: recipients within one campaign are spaced apart by
`delayBetweenMs` (from the compose form, or `DEFAULT_DELAY_BETWEEN_EMAILS_MS`
if left blank) — recipient `i`'s `scheduledFor` is `startTime + i * delayBetweenMs`.
We chose **2000ms (2s)** as the default minimum delay between sends.

### Persistence across restarts
Two layers make this restart-safe:

1. **BullMQ's own delayed-job persistence.** Because delayed jobs live in
   Redis, a server/worker restart doesn't lose them — they simply resume
   being processed once a Worker reconnects. This alone covers the "stop
   server → start again → future emails still send" scenario.
2. **A narrow crash window is covered separately.** If the process crashes
   *between* writing the `EmailJob` row to Postgres and successfully calling
   `queue.add()` for it, that job could be "stuck" with no BullMQ
   counterpart. `runStartupRecovery()` (`src/workers/recovery.ts`) runs once
   at API boot, finds any `EmailJob` rows with `status IN (SCHEDULED,
   QUEUED)` and no `bullJobId`, and re-enqueues them.

### Idempotency
Every BullMQ job is added with `jobId: emailJob.id` — the email's own
Postgres primary key. BullMQ guarantees `jobId` uniqueness per queue, so a
second `add()` call with the same id is a no-op that returns the existing
job. On top of that, the worker itself re-checks the row's status
(`EmailStatus.SENT`) before sending, as a second guard against any
at-least-once redelivery edge case.

### Concurrency & rate limiting
- **Worker concurrency**: `WORKER_CONCURRENCY` (default `5`) is passed
  straight into BullMQ's `Worker({ concurrency })`.
- **Minimum delay between sends**: primarily enforced by spacing
  `scheduledFor` at schedule time (5.1). As a defence-in-depth backstop
  against bursts, the Worker also carries a BullMQ `limiter: { max: 1,
  duration: DEFAULT_DELAY_BETWEEN_EMAILS_MS }`.
- **Hourly limit (the interesting part)**: enforced by
  `src/services/rateLimiter.ts` — an **atomic Redis Lua script**
  (`INCR` + compare + conditional `DECR`) keyed by `rate:{senderId}:{hourBucket}`,
  TTL'd to clean itself up. This is safe across any number of concurrent
  worker processes because the increment-and-check happens as one atomic
  Redis operation — there's no read-then-write race window, unlike a naive
  in-memory counter or a non-atomic `GET` + `SET`.

  When a sender's hourly cap is hit, the job is **never dropped**: the
  worker marks it `RATE_LIMITED_DEFERRED`, computes the start of the next
  hour window, and re-enqueues it as a new delayed job for that time — then
  moves on to the next job. Order is preserved as much as BullMQ's queue
  semantics allow (FIFO within a delay bucket).

  **Trade-off noted**: this is a fixed-window rate limiter, not sliding-window
  — it's simpler and sufficiently accurate for this assignment's scale, but
  can allow a short burst right at a window boundary (e.g. near the end of
  hour N and the start of hour N+1). A production system at very high volume
  might prefer a sliding-window or token-bucket algorithm instead.

### Slack notifications
Real OAuth (`incoming-webhook` + `chat:write` scopes) — see
`src/services/slackService.ts`. The moment `tryReserveSendSlot()` returns
`false` inside the worker, `notifyRateLimitHit()` posts directly to the
user's Slack incoming webhook URL (not just a log line). If the user hasn't
connected Slack, this call looks up their `SlackConnection` row, finds none,
and silently no-ops — no crash. Because the connection is read fresh from
Postgres on every rate-limit hit (not cached in memory), connecting Slack
mid-session starts working immediately on the next hit, with no redeploy.

### Search (Elasticsearch)
Write-through indexing: every place an `EmailJob`'s status changes
(scheduled → queued → sending → sent/failed/deferred) also calls
`indexEmailJob()` (`src/services/searchService.ts`), keeping ES in sync with
Postgres in near-real-time. `GET /api/emails/search?q=...` does a
multi-match search across subject/body/recipient. Indexing failures are
logged but never block the send pipeline — search is a secondary feature,
not on the send-critical path.

**Trade-off noted**: write-through indexing is simple and consistent enough
for this assignment; a system operating at real production scale would more
likely use CDC (e.g. Debezium reading the Postgres WAL) to decouple indexing
from the request/worker path entirely.

### Live BullMQ dashboard
`@bull-board/express` mounted at `/admin/queues`, behind HTTP Basic Auth
(`src/routes/bullBoard.ts` + `basicAuthMiddleware.ts`). Shows jobs moving
through waiting → delayed → active → completed/failed in real time.

### Behavior under load
- All 1000+ `EmailJob` rows are created in a single Prisma transaction
  (`schedulerService.ts`), so a partial failure never leaves a campaign
  half-written.
- Each is enqueued as its own delayed job; BullMQ/Redis comfortably holds
  tens of thousands of delayed jobs in its sorted set.
- Per-recipient scheduling spacing (5.1) means they don't all fire in the
  same instant even if `startTime` is identical for all of them.
- The hourly rate limiter (5.4) then further defers anything that would
  exceed a sender's cap into the next hour window, rather than failing.
- Worker `concurrency` bounds how many are *processed* at once regardless of
  how many are due.
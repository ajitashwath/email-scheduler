# Email Scheduler
A full-stack email scheduling application built for the Outbox Labs assignment.
It provides a Google-authenticated dashboard for composing campaigns, scheduling
emails, monitoring delivery, and receiving Slack alerts when rate limits are hit.

```text
email-scheduler/
├── backend/   // Express, TS, Prisma, PostgreSQL, Redis, BullMQ, Elasticsearch
└── frontend/  // Next.js, TS
```

## Features

### Backend
- REST API for campaigns and email jobs
- PostgreSQL persistence through Prisma
- BullMQ delayed jobs backed by Redis, with no cron
- Separate worker with configurable concurrency
- Ethereal SMTP delivery and saved preview URLs
- Atomic, per-sender hourly rate limiting in Redis
- Elasticsearch indexing and full-text search
- Restart recovery and idempotency protection
- Live Bull Board queue dashboard
- Slack OAuth and live rate-limit notifications

### Frontend
- Real Google OAuth login with user name, email, avatar, and logout
- Scheduled and Sent email views
- Elasticsearch-backed search
- Compose form with recipients, subject, body, start time, delay, and hourly limit
- CSV/text lead upload with detected-email count
- Loading, empty, and basic error states
- Full email detail view with Ethereal preview link
- Responsive layout based on the supplied Figma design

## Prerequisites
- Node.js 20 or newer
- Docker Desktop with the Linux engine running
- A Google OAuth 2.0 Web application client
- A Slack app if Slack notifications are required

## Start infrastructure
```powershell
cd backend
docker compose -f docker\docker-compose.yml up -d
```

The compose file starts:
| Service | Address | Local development credentials |
|---|---|---|
| PostgreSQL | localhost:5432` | database `reachinbox_scheduler`, user `reachinbox`, password `reachinbox` |
| Redis | `localhost:6379` | no password |
| Elasticsearch | `localhost:9200` | security disabled |

## Backend configuration
```powershell
cd backend
Copy-Item .env.example .env
npm install
npx prisma migrate deploy
npx prisma generate
```

The main local settings are:
```env
DATABASE_URL="postgresql://reachinbox:reachinbox@localhost:5432/reachinbox_scheduler?schema=public"
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
JWT_SECRET=use-a-long-random-value
FRONTEND_URL=http://localhost:3000
```

Local development uses `backend/.env`. Deployment uses the separate
`backend/.env.production` file locally, or the
`backend/.env.production.example` template for a fresh setup. Render does not
automatically read repository `.env` files, so copy the production values into
the Render Web Service and Background Worker environment settings. Do not
commit a file containing production secrets.

### Google OAuth
Create a Web application OAuth client and add this exact authorized redirect URI:
```text
http://localhost:4000/api/auth/google/callback
```

Set the following in `backend/.env`:
```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:4000/api/auth/google/callback
```

If the consent screen is in testing mode, add the login account under Google
Cloud → Google Auth Platform → Audience → Test users.

### Slack OAuth
Create a Slack app, add this redirect URL, and enable the bot scopes
`incoming-webhook` and `chat:write`:

```text
http://localhost:4000/api/slack/callback
```

Set:
```env
SLACK_CLIENT_ID=...
SLACK_CLIENT_SECRET=...
SLACK_SIGNING_SECRET=...
SLACK_VERIFICATION_TOKEN=...
SLACK_REDIRECT_URI=http://localhost:4000/api/slack/callback
```

The dashboard's Connect Slack action completes OAuth and stores the returned
workspace webhook per user. Signing and verification values are reserved for
future Slack Events API endpoints.

### SMTP and Ethereal
Ethereal is a safe test SMTP service. It accepts messages but does not deliver
them to real inboxes. Each accepted message receives a preview URL, which is
stored with the email and can be opened from the detail screen.

To use a configured Ethereal account:
```env
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USERNAME=...
SMTP_PASSWORD=...
SMTP_FROM_ADDRESS=...
```

Never commit `.env`, `.env.local`, passwords, OAuth secrets, or access tokens.

## Run the application
Start the API in one terminal:

```powershell
cd backend
npm run dev
```

Start the email worker in a second terminal:
```powershell
cd backend
npm run worker:dev
```

Start the frontend in a third terminal:
```powershell
cd frontend
Copy-Item .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. The API is at `http://localhost:4000`, its health
check is `/health`, and Bull Board is at `/admin/queues`. Bull Board credentials
come from `BULL_BOARD_USER` and `BULL_BOARD_PASSWORD`.

Do not start a second process on the same port. `EADDRINUSE` means another
frontend or backend instance is already running.

## Architecture
### Scheduling without cron

Submitting a campaign writes one campaign and one `EmailJob` row per recipient
to PostgreSQL. Each row is then added to Redis through BullMQ as a delayed job:

```ts
queue.add("send-email", payload, { jobId: emailJob.id, delay: scheduledFor - now });
```

The worker processes the job when its scheduled time arrives. No cron job,
polling loop, or OS scheduler is used.

Recipients are spaced using `delayBetweenMs`; the default is 2 seconds. BullMQ
also applies a queue-wide one-job-per-delay-window limiter as a backstop.

### Persistence and idempotency
Delayed jobs live in Redis, while campaign and email state lives in PostgreSQL.
On API startup, recovery finds scheduled rows without a BullMQ ID and queues
them again. BullMQ job IDs use the PostgreSQL email ID, and the worker skips
rows already marked `SENT`, preventing duplicate sends after redelivery.

### Concurrency and rate limiting
- `WORKER_CONCURRENCY` controls the worker concurrency and defaults to `5`.
- `DEFAULT_DELAY_BETWEEN_EMAILS_MS` defaults to `2000` milliseconds.
- The hourly limit is set per campaign or defaults to
  `DEFAULT_MAX_EMAILS_PER_HOUR`.
- The hourly counter is an atomic Redis Lua operation keyed by sender and hour.
- When a sender reaches its limit, the worker marks the job deferred and
  re-enqueues it for the next hour instead of dropping it.
- When Slack is connected, the worker sends a live notification to the stored
  incoming webhook. Without a connection, it safely does nothing.

For 1,000 or more emails scheduled together, PostgreSQL stores the complete
campaign, Redis stores every delayed job, recipient spacing prevents a burst,
and the hourly limit defers excess work into later windows.

### Search and viewing
Email jobs are write-through indexed in Elasticsearch whenever they are created
or change status. The dashboard search calls `GET /api/emails/search?q=...`
and searches recipient, subject, and body within the authenticated user's data.

Clicking an email opens its stored message body. For Ethereal messages, the
detail view also provides the saved preview URL.

## Checklist
1. Start Docker, the API, the worker, and the frontend.
2. Sign in through Google.
3. Compose a campaign with one or more recipients and a short delay.
4. Show Scheduled emails and Bull Board's delayed/active jobs.
5. Wait for delivery, open Sent, and click the email row.
6. Open the Ethereal preview link from the detail view.
7. Connect Slack, set a small hourly limit, and demonstrate the notification.
8. Schedule a future campaign, restart the worker, and show that future jobs
   remain queued without being duplicated.

## Verification
```powershell
cd backend
npm run build

cd ..\frontend
npm run build
npm run lint
```

// The BullMQ Worker process. Run separately from the API server
// (`npm run worker:dev` / `npm run start:worker`) so send throughput is
// decoupled from HTTP traffic — this mirrors how ReachInbox would run it in
// production (API pods vs worker pods, scaled independently).
//
// Concurrency: controlled by env.WORKER_CONCURRENCY, passed straight to the
// BullMQ Worker's `concurrency` option. BullMQ then runs up to that many
// jobs' processor functions concurrently *within this process*; running
// multiple copies of this file (or multiple containers) adds further
// horizontal concurrency. Because rate limiting is enforced via the
// Redis-backed atomic counter in services/rateLimiter.ts (not in-memory),
// it stays correct regardless of how many worker processes are running.
//
// Delay between sends: env.DEFAULT_DELAY_BETWEEN_EMAILS_MS is applied at
// schedule time (see schedulerService.ts, which spaces out `scheduledFor`
// per recipient) — that is the primary mechanism. As a defence-in-depth
// backstop against bursts (e.g. many campaigns scheduled for the same
// instant), the queue is also configured with a BullMQ rate limiter so the
// worker cannot process jobs faster than one per delay window, using the
// group-less default (queue-wide) limiter.
//
// Hourly rate limit handling: before actually sending, the processor calls
// tryReserveSendSlot(). If the sender's hourly cap is already used up, the
// job is NOT failed — it is re-scheduled (re-enqueued as a new delayed job
// for the start of the next hour window) and marked
// RATE_LIMITED_DEFERRED, and a Slack notification is fired. This satisfies
// "do not drop jobs, defer them" and "notify on rate limit hit".

import "dotenv/config";
import { Worker, Job } from "bullmq";
import { redisConnection } from "../config/redis";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { EMAIL_QUEUE_NAME, EmailJobPayload, enqueueEmailJob } from "../queues/emailQueue";
import { tryReserveSendSlot, nextHourWindowStart } from "../services/rateLimiter";
import { sendEmailViaSender } from "../services/mailService";
import { indexEmailJob } from "../services/searchService";
import { notifyRateLimitHit } from "../services/slackService";
import { EmailStatus } from "@prisma/client";

async function processEmailJob(job: Job<EmailJobPayload>): Promise<void> {
  const { emailJobId, senderId, recipientEmail, subject, body } = job.data;

  // Idempotency guard: if this EmailJob row is already SENT (e.g. this is a
  // stale re-delivery of an at-least-once job after a crash right after we
  // marked it sent but before BullMQ recorded completion), skip re-sending.
  const existing = await prisma.emailJob.findUnique({ where: { id: emailJobId } });
  if (!existing) {
    console.warn(`[worker] EmailJob ${emailJobId} no longer exists, skipping`);
    return;
  }
  if (existing.status === EmailStatus.SENT) {
    console.log(`[worker] EmailJob ${emailJobId} already SENT, skipping duplicate`);
    return;
  }

  const sender = await prisma.sender.findUnique({ where: { id: senderId } });
  if (!sender) {
    throw new Error(`Sender ${senderId} not found`);
  }

  // Look up the campaign's hourly limit override, falling back to the
  // sender's own default.
  const campaign = await prisma.campaign.findUnique({ where: { id: existing.campaignId } });
  const hourlyLimit = campaign?.hourlyLimit ?? sender.maxEmailsPerHour ?? env.DEFAULT_MAX_EMAILS_PER_HOUR;

  // --- Hourly rate limit check (atomic, Redis-backed, multi-worker safe) ---
  const allowed = await tryReserveSendSlot(senderId, hourlyLimit);

  if (!allowed) {
    const nextWindow = nextHourWindowStart();

    const deferred = await prisma.emailJob.update({
      where: { id: emailJobId },
      data: {
        status: EmailStatus.RATE_LIMITED_DEFERRED,
        scheduledFor: nextWindow,
      },
    });
    await indexEmailJob(deferred);

    // Re-enqueue into the next hour window, preserving the same emailJobId
    // as the BullMQ jobId is now stale (job already completed from BullMQ's
    // perspective) — remove isn't needed since this job is currently
    // "active" and will complete normally; we just add a new delayed job.
    const newBullJobId = await enqueueEmailJob(
      { emailJobId, senderId, recipientEmail, subject, body },
      nextWindow
    );
    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: { bullJobId: newBullJobId, status: EmailStatus.QUEUED },
    });

    // Live Slack notification — the moment the limit is hit.
    const user = await prisma.campaign
      .findUnique({ where: { id: existing.campaignId } })
      .user();
    if (user) {
      await notifyRateLimitHit({
        userId: user.id,
        senderLabel: sender.label,
        senderEmail: sender.fromAddress,
        limit: hourlyLimit,
        nextWindowStart: nextWindow,
      });
    }

    console.log(
      `[worker] sender ${sender.label} hourly limit (${hourlyLimit}) reached — deferred email ${emailJobId} to ${nextWindow.toISOString()}`
    );
    return;
  }

  // --- Actually send via Ethereal SMTP ---
  await prisma.emailJob.update({
    where: { id: emailJobId },
    data: { status: EmailStatus.SENDING, attempts: { increment: 1 } },
  });

  try {
    const sendResult = await sendEmailViaSender(
      {
        id: sender.id,
        smtpHost: sender.smtpHost,
        smtpPort: sender.smtpPort,
        smtpUser: sender.smtpUser,
        smtpPass: sender.smtpPass,
        fromAddress: sender.fromAddress,
      },
      recipientEmail,
      subject,
      body
    );

    if (sendResult.previewUrl) {
      console.log(`[worker] Ethereal preview for ${emailJobId}: ${sendResult.previewUrl}`);
    }

    const sent = await prisma.emailJob.update({
      where: { id: emailJobId },
      data: { status: EmailStatus.SENT, sentAt: new Date(), lastError: null, previewUrl: sendResult.previewUrl || null },
    });
    await indexEmailJob(sent);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown send error";
    const failed = await prisma.emailJob.update({
      where: { id: emailJobId },
      data: { status: EmailStatus.FAILED, lastError: message },
    });
    await indexEmailJob(failed);
    throw err; // rethrow so BullMQ applies its retry/backoff policy
  }
}

export const emailWorker = new Worker<EmailJobPayload>(
  EMAIL_QUEUE_NAME,
  processEmailJob,
  {
    connection: redisConnection,
    concurrency: env.WORKER_CONCURRENCY,
    // Defence-in-depth global throttle backstop: the worker will not start
    // more than 1 job per DEFAULT_DELAY_BETWEEN_EMAILS_MS across all of its
    // concurrent slots, on top of the per-recipient scheduling spacing.
    limiter: {
      max: 1,
      duration: env.DEFAULT_DELAY_BETWEEN_EMAILS_MS,
    },
  }
);

emailWorker.on("completed", (job) => {
  console.log(`[worker] completed job ${job.id} (email ${job.data.emailJobId})`);
});

emailWorker.on("failed", (job, err) => {
  console.error(`[worker] job ${job?.id} failed:`, err.message);
});

console.log(
  `[worker] email worker started — concurrency=${env.WORKER_CONCURRENCY}, min delay=${env.DEFAULT_DELAY_BETWEEN_EMAILS_MS}ms`
);

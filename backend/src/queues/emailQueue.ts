// The single BullMQ queue that all outbound emails flow through.
//
// Scheduling strategy: instead of cron, every EmailJob row is added to this
// queue as a *delayed job*, with `delay` computed as
// (scheduledFor - now). BullMQ persists delayed jobs in Redis (a sorted set
// keyed by their trigger timestamp) and will fire them at the right time even
// if the process restarts in the meantime, because the delayed-job state
// lives in Redis, not in process memory. This satisfies the "no cron, survive
// restarts" requirement.
//
// Idempotency: we use the EmailJob's own id (from Postgres) as the BullMQ
// job id (jobId option). BullMQ guarantees jobId uniqueness per queue — a
// second `add()` call with the same jobId is a no-op and returns the existing
// job. So even if our API handler is called twice, or a retry re-adds a job,
// we can never end up with two queue jobs for the same EmailJob row.

import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";

export const EMAIL_QUEUE_NAME = "email-send-queue";

export interface EmailJobPayload {
  emailJobId: string; // Postgres EmailJob.id — also used as the BullMQ jobId
  senderId: string;
  recipientEmail: string;
  subject: string;
  body: string;
}

export const emailQueue = new Queue<EmailJobPayload>(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: {
      age: 60 * 60 * 24 * 7, // keep completed jobs 7 days for dashboard/audit
      count: 5000,
    },
    removeOnFail: {
      age: 60 * 60 * 24 * 30,
    },
  },
});

/**
 * Enqueues (or re-enqueues) a single email as a delayed BullMQ job.
 * Idempotent: calling this twice with the same emailJobId is safe.
 */
export async function enqueueEmailJob(
  payload: EmailJobPayload,
  runAt: Date
): Promise<string> {
  const delay = Math.max(0, runAt.getTime() - Date.now());

  const job = await emailQueue.add("send-email", payload, {
    jobId: payload.emailJobId, // idempotency key
    delay,
  });

  return job.id as string;
}

/**
 * Removes a scheduled (not-yet-processed) job, e.g. if a campaign is
 * cancelled. Safe to call even if the job doesn't exist / already ran.
 */
export async function removeEmailJob(bullJobId: string): Promise<void> {
  const job = await emailQueue.getJob(bullJobId);
  if (job) {
    const state = await job.getState();
    if (state === "delayed" || state === "waiting") {
      await job.remove();
    }
  }
}

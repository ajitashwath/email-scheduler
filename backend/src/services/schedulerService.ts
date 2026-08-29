// Orchestrates turning a "Compose New Email" submission into:
//   1. A Campaign row (the shared subject/body/config)
//   2. One EmailJob row per recipient, each with its own scheduledFor time
//   3. One delayed BullMQ job per EmailJob (see queues/emailQueue.ts)
//
// scheduledFor spacing: recipients are spaced out by `delayBetweenMs`
// starting at `startTime`, so recipient[0] sends at startTime, recipient[1]
// at startTime + delayBetweenMs, etc. This gives us the "minimum delay
// between individual email sends" requirement independent of the rate
// limiter, which is a second, coarser-grained guard (see rateLimiter.ts).
//
// Everything is written to Postgres first (source of truth), then enqueued
// to BullMQ using the Postgres row id as the BullMQ jobId. If the process
// crashes between the DB write and the enqueue, `recoverUnqueuedJobs()`
// (called on boot — see workers/recovery.ts) finds any EmailJob rows that
// don't yet have a bullJobId and enqueues them, so nothing is lost.

import { prisma } from "../config/prisma";
import { enqueueEmailJob } from "../queues/emailQueue";
import { indexEmailJob } from "./searchService";
import { EmailStatus } from "@prisma/client";

export interface ScheduleCampaignInput {
  userId: string;
  senderId: string;
  subject: string;
  body: string;
  recipients: string[];
  startTime: Date;
  delayBetweenMs: number;
  hourlyLimit?: number;
}

export interface ScheduleCampaignResult {
  campaignId: string;
  emailJobIds: string[];
}

export async function scheduleCampaign(
  input: ScheduleCampaignInput
): Promise<ScheduleCampaignResult> {
  const {
    userId,
    senderId,
    subject,
    body,
    recipients,
    startTime,
    delayBetweenMs,
    hourlyLimit,
  } = input;

  // 1. Persist the campaign + all email rows in a single transaction so we
  //    never end up with a campaign that has zero or partial email rows.
  const campaign = await prisma.campaign.create({
    data: {
      userId,
      subject,
      body,
      startTime,
      delayBetweenMs,
      hourlyLimit,
      totalRecipients: recipients.length,
      emails: {
        create: recipients.map((recipientEmail, index) => ({
          senderId,
          recipientEmail,
          subject,
          body,
          scheduledFor: new Date(startTime.getTime() + index * delayBetweenMs),
          status: EmailStatus.SCHEDULED,
        })),
      },
    },
    include: { emails: true },
  });

  // 2. Enqueue each email as a delayed BullMQ job, keyed by its own row id.
  const emailJobIds: string[] = [];
  for (const emailJob of campaign.emails) {
    const bullJobId = await enqueueEmailJob(
      {
        emailJobId: emailJob.id,
        senderId: emailJob.senderId,
        recipientEmail: emailJob.recipientEmail,
        subject: emailJob.subject,
        body: emailJob.body,
      },
      emailJob.scheduledFor
    );

    const updated = await prisma.emailJob.update({
      where: { id: emailJob.id },
      data: { bullJobId, status: EmailStatus.QUEUED },
    });

    await indexEmailJob(updated);
    emailJobIds.push(emailJob.id);
  }

  return { campaignId: campaign.id, emailJobIds };
}

/**
 * Recovery pass, run once at process startup (see workers/recovery.ts).
 * Finds any EmailJob rows that are SCHEDULED/QUEUED but have no bullJobId
 * (meaning the process crashed after the DB write but before/during the
 * enqueue) and (re)enqueues them. Uses the EmailJob id as the BullMQ jobId,
 * so if the job was actually already added to BullMQ despite bullJobId not
 * being persisted, the add() call is a harmless idempotent no-op.
 */
export async function recoverUnqueuedJobs(): Promise<number> {
  const pending = await prisma.emailJob.findMany({
    where: {
      status: { in: [EmailStatus.SCHEDULED, EmailStatus.QUEUED] },
      OR: [{ bullJobId: null }],
    },
  });

  for (const job of pending) {
    const bullJobId = await enqueueEmailJob(
      {
        emailJobId: job.id,
        senderId: job.senderId,
        recipientEmail: job.recipientEmail,
        subject: job.subject,
        body: job.body,
      },
      job.scheduledFor
    );

    await prisma.emailJob.update({
      where: { id: job.id },
      data: { bullJobId, status: EmailStatus.QUEUED },
    });
  }

  return pending.length;
}

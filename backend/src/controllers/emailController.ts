import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import { prisma } from "../config/prisma";
import { searchEmailJobs } from "../services/searchService";
import { EmailStatus } from "@prisma/client";

const PAGE_SIZE = 25;

/**
 * GET /api/emails/scheduled
 * Backs the "Scheduled Emails" tab: everything not yet sent or failed.
 */
export async function listScheduledEmails(req: AuthedRequest, res: Response): Promise<void> {
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10));

  const where = {
    campaign: { userId: req.userId },
    status: { in: [EmailStatus.SCHEDULED, EmailStatus.QUEUED, EmailStatus.RATE_LIMITED_DEFERRED, EmailStatus.SENDING] },
  };

  const [emails, total] = await Promise.all([
    prisma.emailJob.findMany({
      where,
      orderBy: { scheduledFor: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        recipientEmail: true,
        subject: true,
        scheduledFor: true,
        status: true,
        previewUrl: true,
      },
    }),
    prisma.emailJob.count({ where }),
  ]);

  res.json({ emails, total, page, pageSize: PAGE_SIZE });
}

/**
 * GET /api/emails/sent
 * Backs the "Sent Emails" tab: SENT or FAILED (terminal states).
 */
export async function listSentEmails(req: AuthedRequest, res: Response): Promise<void> {
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10));

  const where = {
    campaign: { userId: req.userId },
    status: { in: [EmailStatus.SENT, EmailStatus.FAILED] },
  };

  const [emails, total] = await Promise.all([
    prisma.emailJob.findMany({
      where,
      orderBy: { sentAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        recipientEmail: true,
        subject: true,
        sentAt: true,
        status: true,
        lastError: true,
        previewUrl: true,
      },
    }),
    prisma.emailJob.count({ where }),
  ]);

  res.json({ emails, total, page, pageSize: PAGE_SIZE });
}

/**
 * GET /api/emails/search?q=...&status=...
 * Elasticsearch-backed full text search across subject/body/recipient.
 */
export async function searchEmails(req: AuthedRequest, res: Response): Promise<void> {
  const query = (req.query.q as string) ?? "";
  const status = req.query.status as string | undefined;

  const result = await searchEmailJobs({ query, status, userId: req.userId });
  res.json(result);
}

/** GET /api/emails/:id — open one scheduled or sent email in the dashboard. */
export async function getEmailById(req: AuthedRequest, res: Response): Promise<void> {
  const email = await prisma.emailJob.findFirst({
    where: {
      id: req.params.id,
      campaign: { userId: req.userId },
    },
    select: {
      id: true,
      recipientEmail: true,
      subject: true,
      body: true,
      scheduledFor: true,
      sentAt: true,
      status: true,
      lastError: true,
      previewUrl: true,
      sender: { select: { fromAddress: true } },
    },
  });

  if (!email) {
    res.status(404).json({ error: "Email not found" });
    return;
  }

  res.json({ email });
}

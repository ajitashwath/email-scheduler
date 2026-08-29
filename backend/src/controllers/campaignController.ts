import { Response } from "express";
import { z } from "zod";
import { AuthedRequest } from "../middleware/auth";
import { prisma } from "../config/prisma";
import { parseLeadsFile } from "../utils/parseLeads";
import { scheduleCampaign } from "../services/schedulerService";
import { env } from "../config/env";

const composeBodySchema = z.object({
  senderId: z.string().uuid().optional(),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Body is required"),
  startTime: z.coerce.date(),
  delayBetweenMs: z.coerce.number().int().positive().default(env.DEFAULT_DELAY_BETWEEN_EMAILS_MS),
  hourlyLimit: z.coerce.number().int().positive().optional(),
  // Allows scheduling without a file upload too, e.g. from Postman/tests.
  recipients: z.array(z.string().email()).optional(),
});

/**
 * POST /api/leads/parse
 * multipart/form-data with a `file` field. Returns the parsed, deduplicated
 * list of emails and a count, without persisting anything yet — this powers
 * the "Upload CSV -> show number of email addresses detected" UX before the
 * user hits Schedule.
 */
export async function parseLeadsUpload(req: AuthedRequest, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const emails = parseLeadsFile(req.file.buffer);
  res.json({ count: emails.length, emails });
}

/**
 * POST /api/campaigns
 * Creates a campaign + schedules all its EmailJob rows as delayed BullMQ
 * jobs. Accepts recipients either as a JSON array in the body, or (more
 * commonly from the UI) the client first calls /api/leads/parse and then
 * passes the resulting `emails` array here alongside the compose form.
 */
export async function createCampaign(req: AuthedRequest, res: Response): Promise<void> {
  const parseResult = composeBodySchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.flatten().fieldErrors });
    return;
  }

  const { senderId, subject, body, startTime, delayBetweenMs, hourlyLimit, recipients } =
    parseResult.data;

  if (!recipients || recipients.length === 0) {
    res.status(400).json({ error: "At least one recipient is required" });
    return;
  }

  // Resolve sender: use the provided senderId, or fall back to the user's
  // first (default) sender.
  const sender = senderId
    ? await prisma.sender.findFirst({ where: { id: senderId, userId: req.userId } })
    : await prisma.sender.findFirst({ where: { userId: req.userId } });

  if (!sender) {
    res.status(400).json({ error: "No sender configured for this account" });
    return;
  }

  const result = await scheduleCampaign({
    userId: req.userId!,
    senderId: sender.id,
    subject,
    body,
    recipients,
    startTime,
    delayBetweenMs,
    hourlyLimit,
  });

  res.status(201).json(result);
}

/** GET /api/senders — list this user's sending identities */
export async function listSenders(req: AuthedRequest, res: Response): Promise<void> {
  const senders = await prisma.sender.findMany({
    where: { userId: req.userId },
    select: { id: true, label: true, fromAddress: true, maxEmailsPerHour: true },
  });
  res.json({ senders });
}

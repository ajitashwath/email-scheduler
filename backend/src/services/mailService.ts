// Handles actual SMTP delivery via Ethereal Email (https://ethereal.email),
// a fake SMTP service intended for testing — messages are captured by
// Ethereal and viewable via a preview URL, never delivered to a real inbox.
//
// A nodemailer transporter is created per-sender (senders can have distinct
// Ethereal credentials) and cached so we don't reconnect on every send.

import nodemailer, { Transporter } from "nodemailer";
import { env } from "../config/env";

const transporterCache = new Map<string, Transporter>();

export interface SenderCredentials {
  id: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  fromAddress: string;
}

function getTransporter(sender: SenderCredentials): Transporter {
  const cached = transporterCache.get(sender.id);
  if (cached) return cached;

  const transporter = nodemailer.createTransport({
    host: sender.smtpHost,
    port: sender.smtpPort,
    secure: sender.smtpPort === 465,
    auth: {
      user: sender.smtpUser,
      pass: sender.smtpPass,
    },
  });

  transporterCache.set(sender.id, transporter);
  return transporter;
}

export interface SendEmailResult {
  messageId: string;
  previewUrl: string | false;
}

export async function sendEmailViaSender(
  sender: SenderCredentials,
  to: string,
  subject: string,
  html: string
): Promise<SendEmailResult> {
  const transporter = getTransporter(sender);

  const info = await transporter.sendMail({
    from: sender.fromAddress,
    to,
    subject,
    html,
  });

  return {
    messageId: info.messageId,
    previewUrl: nodemailer.getTestMessageUrl(info),
  };
}

/**
 * Convenience helper to create a fresh Ethereal test account (host/port/user/
 * pass). Used by the seed script so a developer running this project doesn't
 * have to manually sign up on ethereal.email before the demo works.
 */
export async function createEtherealTestAccount() {
  const account = await nodemailer.createTestAccount();
  return {
    smtpHost: account.smtp.host,
    smtpPort: account.smtp.port,
    smtpUser: account.user,
    smtpPass: account.pass,
    fromAddress: account.user,
  };
}

export function getConfiguredSmtpSender() {
  if (!env.SMTP_HOST || !env.SMTP_USERNAME || !env.SMTP_PASSWORD || !env.SMTP_FROM_ADDRESS) {
    return null;
  }

  return {
    smtpHost: env.SMTP_HOST,
    smtpPort: env.SMTP_PORT,
    smtpUser: env.SMTP_USERNAME,
    smtpPass: env.SMTP_PASSWORD,
    fromAddress: env.SMTP_FROM_ADDRESS,
  };
}

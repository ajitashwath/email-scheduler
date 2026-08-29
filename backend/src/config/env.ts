// Centralized environment configuration. All env access in the app should go
// through this module instead of process.env directly, so we fail fast at
// boot if something required is missing, rather than failing deep inside a
// worker at 2am.

import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),

  // Postgres
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Redis (BullMQ)
  REDIS_HOST: z.string().default("127.0.0.1"),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  // Auth
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 chars"),
  FRONTEND_URL: z.string().default("http://localhost:3000"),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),
  GOOGLE_REDIRECT_URI: z.string().default("http://localhost:4000/api/auth/google/callback"),

  // Slack OAuth
  SLACK_CLIENT_ID: z.string().optional(),
  SLACK_CLIENT_SECRET: z.string().optional(),
  SLACK_SIGNING_SECRET: z.string().optional(),
  SLACK_VERIFICATION_TOKEN: z.string().optional(),
  SLACK_REDIRECT_URI: z.string().default("http://localhost:4000/api/slack/callback"),

  // Ethereal / SMTP defaults (used when seeding default senders)
  ETHEREAL_SMTP_HOST: z.string().default("smtp.ethereal.email"),
  ETHEREAL_SMTP_PORT: z.coerce.number().default(587),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USERNAME: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM_ADDRESS: z.string().email().optional(),

  // Elasticsearch
  ELASTICSEARCH_NODE: z.string().default("http://localhost:9200"),
  ELASTICSEARCH_USERNAME: z.string().optional(),
  ELASTICSEARCH_PASSWORD: z.string().optional(),
  ELASTICSEARCH_INDEX: z.string().default("email_jobs"),

  // Scheduler tuning
  WORKER_CONCURRENCY: z.coerce.number().default(5),
  DEFAULT_DELAY_BETWEEN_EMAILS_MS: z.coerce.number().default(2000),
  DEFAULT_MAX_EMAILS_PER_HOUR: z.coerce.number().default(200),

  // Bull Board dashboard basic auth
  BULL_BOARD_USER: z.string().default("admin"),
  BULL_BOARD_PASSWORD: z.string().default("admin"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

// Elasticsearch client used to make scheduled/sent emails searchable.
// Index is created (if missing) on server boot via ensureEmailIndex().

import { Client } from "@elastic/elasticsearch";
import { env } from "./env";

export const esClient = new Client({
  node: env.ELASTICSEARCH_NODE,
  auth:
    env.ELASTICSEARCH_USERNAME && env.ELASTICSEARCH_PASSWORD
      ? { username: env.ELASTICSEARCH_USERNAME, password: env.ELASTICSEARCH_PASSWORD }
      : undefined,
});

export const EMAIL_INDEX = env.ELASTICSEARCH_INDEX;

/**
 * Creates the email_jobs index with an explicit mapping if it doesn't already
 * exist. Called once at server startup. Failures here are logged but do not
 * crash the server — search is a secondary feature, email sending must keep
 * working even if ES is temporarily down.
 */
export async function ensureEmailIndex(): Promise<void> {
  try {
    const exists = await esClient.indices.exists({ index: EMAIL_INDEX });
    if (exists) return;

    await esClient.indices.create({
      index: EMAIL_INDEX,
      mappings: {
        properties: {
          id: { type: "keyword" },
          campaignId: { type: "keyword" },
          senderId: { type: "keyword" },
          userId: { type: "keyword" },
          recipientEmail: { type: "keyword" },
          subject: { type: "text" },
          body: { type: "text" },
          status: { type: "keyword" },
          scheduledFor: { type: "date" },
          sentAt: { type: "date" },
          createdAt: { type: "date" },
        },
      },
    });
    console.log(`[elasticsearch] created index "${EMAIL_INDEX}"`);
  } catch (err) {
    console.error("[elasticsearch] failed to ensure index (search will be degraded):", err);
  }
}

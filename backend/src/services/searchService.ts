// Keeps Elasticsearch in sync with Postgres for the EmailJob entity and
// exposes a search function used by GET /api/emails/search.
//
// Indexing strategy: write-through. Every place that changes an EmailJob's
// status (scheduling, sending, marking sent/failed) also calls indexEmailJob
// so ES reflects Postgres almost immediately. This is simpler and more
// consistent than a separate batch sync job for an assignment of this size;
// a production system at real scale would likely use a CDC pipeline
// (Debezium) instead — noted as a trade-off in the README.

import { EmailJob } from "@prisma/client";
import { esClient, EMAIL_INDEX } from "../config/elasticsearch";
import { prisma } from "../config/prisma";

export async function indexEmailJob(job: EmailJob & { userId?: string }): Promise<void> {
  try {
    const userId = job.userId ?? (await prisma.campaign.findUnique({
      where: { id: job.campaignId },
      select: { userId: true },
    }))?.userId;

    await esClient.index({
      index: EMAIL_INDEX,
      id: job.id,
      document: {
        id: job.id,
        campaignId: job.campaignId,
        userId,
        senderId: job.senderId,
        recipientEmail: job.recipientEmail,
        subject: job.subject,
        body: job.body,
        status: job.status,
        scheduledFor: job.scheduledFor,
        sentAt: job.sentAt,
        previewUrl: job.previewUrl,
        lastError: job.lastError,
        createdAt: job.createdAt,
      },
    });
  } catch (err) {
    // Search indexing must never break the send/schedule pipeline.
    console.error(`[elasticsearch] failed to index email job ${job.id}:`, err);
  }
}

export interface EmailSearchParams {
  query: string;
  status?: string;
  userId?: string;
  from?: number;
  size?: number;
}

export async function searchEmailJobs(params: EmailSearchParams) {
  const { query, status, userId, from = 0, size = 20 } = params;

  const filter: Record<string, unknown>[] = [];
  if (status) {
    const statuses = status.split(",").filter(Boolean);
    filter.push(statuses.length > 1 ? { terms: { status: statuses } } : { term: { status } });
  }
  if (userId) {
    filter.push({ term: { userId } });
  }

  const result = await esClient.search({
    index: EMAIL_INDEX,
    from,
    size,
    query: {
      bool: {
        must: query
          ? [
              {
                multi_match: {
                  query,
                  fields: ["subject", "body", "recipientEmail"],
                },
              },
            ]
          : [{ match_all: {} }],
        filter,
      },
    },
    sort: [{ createdAt: { order: "desc" } }],
  });

  const hits = result.hits.hits.map((h) => h._source);
  return {
    total:
      typeof result.hits.total === "number"
        ? result.hits.total
        : result.hits.total?.value ?? 0,
    emails: hits,
    page: Math.floor(from / size) + 1,
    pageSize: size,
  };
}

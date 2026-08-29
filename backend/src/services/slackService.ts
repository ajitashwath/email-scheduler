// Slack integration.
//
// OAuth flow (standard Slack "Add to Slack" flow using the
// `incoming-webhook` + `chat:write` scopes):
//   1. Frontend "Connect Slack" button links to GET /api/slack/authorize,
//      which redirects to slack.com/oauth/v2/authorize.
//   2. Slack redirects back to GET /api/slack/callback with a `code`.
//   3. We exchange the code for an access token + incoming webhook URL via
//      https://slack.com/api/oauth.v2.access, and persist it against the
//      logged-in user (SlackConnection row).
//   4. From then on, notifyRateLimitHit() posts directly to that webhook URL
//      whenever a sender's hourly cap is reached.
//
// Disconnected users: notifyRateLimitHit() looks up the SlackConnection by
// userId; if none exists it simply no-ops (no crash, no notification). If
// the user connects Slack later, the very next rate-limit hit will notify
// them — no redeploy needed, since we read the connection from Postgres at
// call time rather than caching it in memory.

import axios from "axios";
import { prisma } from "../config/prisma";
import { env } from "../config/env";

const SLACK_OAUTH_AUTHORIZE_URL = "https://slack.com/oauth/v2/authorize";
const SLACK_OAUTH_ACCESS_URL = "https://slack.com/api/oauth.v2.access";

export function buildSlackAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID ?? "",
    scope: "incoming-webhook,chat:write",
    redirect_uri: env.SLACK_REDIRECT_URI,
    state,
  });
  return `${SLACK_OAUTH_AUTHORIZE_URL}?${params.toString()}`;
}

interface SlackOAuthResponse {
  ok: boolean;
  access_token: string;
  team: { id: string; name: string };
  incoming_webhook?: { url: string; channel: string };
  error?: string;
}

/**
 * Exchanges an OAuth `code` for an access token + incoming webhook, and
 * upserts the SlackConnection row for the given user.
 */
export async function connectSlackForUser(userId: string, code: string): Promise<void> {
  const { data } = await axios.post<SlackOAuthResponse>(
    SLACK_OAUTH_ACCESS_URL,
    new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID ?? "",
      client_secret: env.SLACK_CLIENT_SECRET ?? "",
      code,
      redirect_uri: env.SLACK_REDIRECT_URI,
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  if (!data.ok || !data.incoming_webhook) {
    throw new Error(`Slack OAuth failed: ${data.error ?? "unknown error"}`);
  }

  await prisma.slackConnection.upsert({
    where: { userId },
    create: {
      userId,
      teamId: data.team.id,
      teamName: data.team.name,
      webhookUrl: data.incoming_webhook.url,
      channel: data.incoming_webhook.channel,
      accessToken: data.access_token,
    },
    update: {
      teamId: data.team.id,
      teamName: data.team.name,
      webhookUrl: data.incoming_webhook.url,
      channel: data.incoming_webhook.channel,
      accessToken: data.access_token,
    },
  });
}

export async function disconnectSlackForUser(userId: string): Promise<void> {
  await prisma.slackConnection.deleteMany({ where: { userId } });
}

/**
 * Posts a live message to the user's connected Slack workspace the moment a
 * sender's hourly rate limit is hit. No-ops silently if not connected.
 */
export async function notifyRateLimitHit(params: {
  userId: string;
  senderLabel: string;
  senderEmail: string;
  limit: number;
  nextWindowStart: Date;
}): Promise<void> {
  const connection = await prisma.slackConnection.findUnique({
    where: { userId: params.userId },
  });

  if (!connection) {
    // User hasn't connected Slack — this is expected and not an error.
    return;
  }

  const text =
    `:warning: *Hourly rate limit reached* for sender *${params.senderLabel}* ` +
    `(${params.senderEmail}). Limit: ${params.limit}/hour. ` +
    `Remaining emails have been deferred to ${params.nextWindowStart.toISOString()}.`;

  try {
    await axios.post(connection.webhookUrl, { text });
  } catch (err) {
    // A failed Slack notification must never fail the email pipeline.
    console.error("[slack] failed to send rate-limit notification:", err);
  }
}

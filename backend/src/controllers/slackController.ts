import { Response } from "express";
import crypto from "crypto";
import { AuthedRequest } from "../middleware/auth";
import { buildSlackAuthorizeUrl, connectSlackForUser, disconnectSlackForUser } from "../services/slackService";
import { prisma } from "../config/prisma";
import { env } from "../config/env";

const SLACK_STATE_COOKIE = "slack_oauth_state";

/** GET /api/slack/authorize — starts the real Slack OAuth flow */
export function slackAuthorizeRedirect(req: AuthedRequest, res: Response): void {
  // Encode the userId into the state so the callback (which Slack calls
  // without our session context guaranteed) knows which user to attach the
  // connection to. Signed loosely via a random nonce cookie check too.
  const nonce = crypto.randomBytes(8).toString("hex");
  const state = `${req.userId}.${nonce}`;

  res.cookie(SLACK_STATE_COOKIE, nonce, { httpOnly: true, maxAge: 5 * 60 * 1000, sameSite: "lax" });
  res.redirect(buildSlackAuthorizeUrl(state));
}

/** GET /api/slack/callback */
export async function slackCallback(req: AuthedRequest, res: Response): Promise<void> {
  const { code, state } = req.query as { code?: string; state?: string };
  const expectedNonce = req.cookies?.[SLACK_STATE_COOKIE];

  if (!code || !state) {
    res.redirect(`${env.FRONTEND_URL}/dashboard?slack=error`);
    return;
  }

  const [userId, nonce] = state.split(".");
  if (nonce !== expectedNonce) {
    res.redirect(`${env.FRONTEND_URL}/dashboard?slack=error`);
    return;
  }

  try {
    await connectSlackForUser(userId, code);
    res.clearCookie(SLACK_STATE_COOKIE);
    res.redirect(`${env.FRONTEND_URL}/dashboard?slack=connected`);
  } catch (err) {
    console.error("[slack] OAuth callback failed:", err);
    res.redirect(`${env.FRONTEND_URL}/dashboard?slack=error`);
  }
}

/** GET /api/slack/status */
export async function slackStatus(req: AuthedRequest, res: Response): Promise<void> {
  const connection = await prisma.slackConnection.findUnique({ where: { userId: req.userId } });
  res.json({
    connected: !!connection,
    teamName: connection?.teamName ?? null,
    channel: connection?.channel ?? null,
  });
}

/** POST /api/slack/disconnect */
export async function slackDisconnect(req: AuthedRequest, res: Response): Promise<void> {
  await disconnectSlackForUser(req.userId!);
  res.json({ success: true });
}

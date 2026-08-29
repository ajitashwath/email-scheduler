import { Request, Response } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { buildGoogleAuthUrl, exchangeCodeForProfile } from "../services/googleAuthService";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { AuthedRequest } from "../middleware/auth";
import { createEtherealTestAccount } from "../services/mailService";

const SESSION_COOKIE = "session";
const OAUTH_STATE_COOKIE = "oauth_state";

/** GET /api/auth/google — redirect the browser into Google's consent screen. */
export function googleLoginRedirect(req: Request, res: Response): void {
  const state = crypto.randomBytes(16).toString("hex");
  res.cookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    maxAge: 5 * 60 * 1000,
    sameSite: "lax",
  });
  res.redirect(buildGoogleAuthUrl(state));
}

/** GET /api/auth/google/callback — Google redirects here with ?code&state */
export async function googleLoginCallback(req: Request, res: Response): Promise<void> {
  const { code, state } = req.query as { code?: string; state?: string };
  const expectedState = req.cookies?.[OAUTH_STATE_COOKIE];

  if (!code || !state || state !== expectedState) {
    res.redirect(`${env.FRONTEND_URL}/login?error=invalid_state`);
    return;
  }

  try {
    const profile = await exchangeCodeForProfile(code);

    let user = await prisma.user.findUnique({ where: { googleId: profile.googleId } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          googleId: profile.googleId,
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
        },
      });

      // Give newly-registered users a working Ethereal sender out of the box
      // so the "Compose New Email" flow works immediately after first login,
      // without a manual setup step.
      const ethereal = await createEtherealTestAccount();
      await prisma.sender.create({
        data: {
          userId: user.id,
          label: "Default Ethereal Sender",
          ...ethereal,
          maxEmailsPerHour: env.DEFAULT_MAX_EMAILS_PER_HOUR,
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { name: profile.name, avatarUrl: profile.avatarUrl },
      });
    }

    const token = jwt.sign({ userId: user.id }, env.JWT_SECRET, { expiresIn: "7d" });
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
    });
    res.clearCookie(OAUTH_STATE_COOKIE);

    res.redirect(`${env.FRONTEND_URL}/dashboard`);
  } catch (err) {
    console.error("[auth] Google login failed:", err);
    res.redirect(`${env.FRONTEND_URL}/login?error=oauth_failed`);
  }
}

/** GET /api/auth/me — return the current logged-in user */
export async function getCurrentUser(req: AuthedRequest, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, name: true, email: true, avatarUrl: true },
  });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ user });
}

/** POST /api/auth/logout */
export function logout(req: Request, res: Response): void {
  res.clearCookie(SESSION_COOKIE);
  res.json({ success: true });
}

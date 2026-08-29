// Real Google OAuth 2.0 login (Authorization Code flow) using
// google-auth-library. No mocking — this exchanges a real code for real
// tokens and fetches the actual Google profile (name, email, avatar).

import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env";

export const googleOAuthClient = new OAuth2Client(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  env.GOOGLE_REDIRECT_URI
);

export function buildGoogleAuthUrl(state: string): string {
  return googleOAuthClient.generateAuthUrl({
    access_type: "online",
    scope: ["openid", "email", "profile"],
    prompt: "select_account",
    state,
  });
}

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export async function exchangeCodeForProfile(code: string): Promise<GoogleProfile> {
  const { tokens } = await googleOAuthClient.getToken(code);

  if (!tokens.id_token) {
    throw new Error("Google OAuth response did not include an id_token");
  }

  const ticket = await googleOAuthClient.verifyIdToken({
    idToken: tokens.id_token,
    audience: env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.sub || !payload.email) {
    throw new Error("Google ID token payload missing required fields");
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name ?? payload.email,
    avatarUrl: payload.picture ?? null,
  };
}

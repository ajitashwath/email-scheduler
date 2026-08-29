// Verifies the session JWT (issued after Google login, stored as an
// httpOnly cookie) and attaches the authenticated user's id to the request.

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface AuthedRequest extends Request {
  userId?: string;
}

interface SessionTokenPayload {
  userId: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = req.cookies?.session;

  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as SessionTokenPayload;
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired session" });
  }
}

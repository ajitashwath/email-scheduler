import { Request, Response, NextFunction } from "express";
import { env } from "../config/env";

/** Minimal HTTP Basic Auth guard for the /admin/queues Bull Board route. */
export default function basicAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Basic ")) {
    res.set("WWW-Authenticate", "Basic realm=\"Bull Board\"");
    res.status(401).send("Authentication required");
    return;
  }

  const decoded = Buffer.from(header.slice(6), "base64").toString("utf-8");
  const [user, pass] = decoded.split(":");

  if (user === env.BULL_BOARD_USER && pass === env.BULL_BOARD_PASSWORD) {
    next();
    return;
  }

  res.set("WWW-Authenticate", "Basic realm=\"Bull Board\"");
  res.status(401).send("Invalid credentials");
}

import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { ensureEmailIndex } from "./config/elasticsearch";
import { runStartupRecovery } from "./workers/recovery";

import authRoutes from "./routes/authRoutes";
import slackRoutes from "./routes/slackRoutes";
import campaignRoutes from "./routes/campaignRoutes";
import emailRoutes from "./routes/emailRoutes";
import bullBoardRoutes from "./routes/bullBoard";

const app = express();

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/slack", slackRoutes);
app.use("/api", campaignRoutes);
app.use("/api/emails", emailRoutes);

// Live BullMQ dashboard for real-time queue visibility (protected by basic auth).
app.use("/admin/queues", bullBoardRoutes);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[server] unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

async function bootstrap(): Promise<void> {
  await ensureEmailIndex();
  await runStartupRecovery();

  app.listen(env.PORT, () => {
    console.log(`[server] listening on http://localhost:${env.PORT}`);
    console.log(`[server] Bull Board dashboard: http://localhost:${env.PORT}/admin/queues`);
  });
}

bootstrap().catch((err) => {
  console.error("[server] failed to start:", err);
  process.exit(1);
});

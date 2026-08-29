// Exposes a live Bull Board UI at /admin/queues so anyone reviewing this
// assignment can watch jobs move through waiting -> delayed -> active ->
// completed/failed in real time. Protected with HTTP Basic Auth since it
// exposes job payloads (recipient emails, subjects).

import { Router } from "express";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import basicAuth from "./basicAuthMiddleware";
import { emailQueue } from "../queues/emailQueue";

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});

const router = Router();
router.use("/", basicAuth, serverAdapter.getRouter());

export default router;

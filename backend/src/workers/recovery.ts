// Runs once when the API server boots. BullMQ's own delayed jobs already
// survive a restart on their own (they live in Redis), so in the common
// case there is nothing to do here. This module exists to cover the edge
// case where the process crashed in the narrow window between writing an
// EmailJob row to Postgres and successfully calling queue.add() for it —
// which would otherwise leave an EmailJob "stuck" with no corresponding
// BullMQ job and therefore never sent.

import { recoverUnqueuedJobs } from "../services/schedulerService";

export async function runStartupRecovery(): Promise<void> {
  console.log("[recovery] checking for unqueued email jobs after restart...");
  const count = await recoverUnqueuedJobs();
  if (count > 0) {
    console.log(`[recovery] re-enqueued ${count} email job(s) that were missing from the queue`);
  } else {
    console.log("[recovery] no orphaned jobs found — all scheduled emails are safely queued");
  }
}

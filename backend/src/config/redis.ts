// Shared ioredis connection used by BullMQ (queues, workers, schedulers) and
// by the custom rate-limit counters. BullMQ requires maxRetriesPerRequest set
// to null on connections handed to Workers/QueueEvents.

import IORedis from "ioredis";
import { env } from "./env";

export const redisConnection = new IORedis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
  maxRetriesPerRequest: null, // required by BullMQ workers
  enableReadyCheck: true,
});

redisConnection.on("error", (err) => {
  console.error("[redis] connection error:", err.message);
});

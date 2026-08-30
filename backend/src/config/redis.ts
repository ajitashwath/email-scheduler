// Shared ioredis connection used by BullMQ (queues, workers, schedulers) and
// by the custom rate-limit counters. BullMQ requires maxRetriesPerRequest set
// to null on connections handed to Workers/QueueEvents.

import IORedis from "ioredis";
import { env } from "./env";

const redisOptions = {
  maxRetriesPerRequest: null as null,
  enableReadyCheck: true,
};

export const redisConnection = env.REDIS_URL
  ? new IORedis(env.REDIS_URL, redisOptions)
  : new IORedis({
      ...redisOptions,
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      ...(env.REDIS_PASSWORD ? { password: env.REDIS_PASSWORD } : {}),
    });

redisConnection.on("error", (err) => {
  console.error("[redis] connection error:", err.message);
});

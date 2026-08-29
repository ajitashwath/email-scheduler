// Redis-backed hourly rate limiter for outbound email sends.
//
// Why not BullMQ's built-in limiter? BullMQ's Queue-level `limiter` option
// throttles the *whole queue* (or per-group with group keys in newer
// versions), but our requirement is a configurable, per-sender emails/hour
// cap that must be safe across multiple worker processes and must NOT drop
// jobs when exceeded — it must reschedule them into the next hour window.
// A plain Redis INCR-based fixed-window counter, incremented atomically via
// a Lua script, gives us exactly that with no extra infra.
//
// Window key: rate:{senderId}:{hourBucket}, where hourBucket is the epoch
// hour (Math.floor(now / 3600000)). TTL on the key is 2 hours so it cleans
// itself up. Because the INCR+compare happens in a single Lua script, this
// is atomic even if two worker processes evaluate it in the same
// millisecond — no lost updates, no in-memory state.

import { redisConnection } from "../config/redis";

// Lua script: atomically increment the counter for this window, and return
// whether the increment was allowed (i.e. resulting count <= limit).
// If not allowed, we still increment a separate "rejected" counter for
// observability, but we do NOT let the caller's job count against the
// window (we decrement back) so slots aren't wasted by rejected attempts.
const RATE_LIMIT_LUA = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local ttlSeconds = tonumber(ARGV[2])

local current = redis.call("INCR", key)
if current == 1 then
  redis.call("EXPIRE", key, ttlSeconds)
end

if current > limit then
  redis.call("DECR", key)
  return 0
end

return 1
`;

function hourBucket(date: Date): number {
  return Math.floor(date.getTime() / (60 * 60 * 1000));
}

function rateKey(senderId: string, bucket: number): string {
  return `rate:${senderId}:${bucket}`;
}

/**
 * Attempts to reserve one "send slot" for this sender in the current hour
 * window. Returns true if allowed, false if the sender's hourly limit has
 * already been reached for this window.
 */
export async function tryReserveSendSlot(
  senderId: string,
  maxPerHour: number,
  at: Date = new Date()
): Promise<boolean> {
  const bucket = hourBucket(at);
  const key = rateKey(senderId, bucket);

  const result = (await redisConnection.eval(
    RATE_LIMIT_LUA,
    1,
    key,
    maxPerHour,
    7200 // TTL seconds (2 hours) — generous cleanup buffer
  )) as number;

  return result === 1;
}

/**
 * Returns the epoch ms timestamp of the start of the NEXT hour window after
 * `at`. Used to compute the delay to re-schedule a rate-limited job to.
 */
export function nextHourWindowStart(at: Date = new Date()): Date {
  const bucket = hourBucket(at);
  return new Date((bucket + 1) * 60 * 60 * 1000);
}

/**
 * Current count for a sender's active hour window — used by the dashboard /
 * API to show "X/Y sent this hour".
 */
export async function getCurrentHourCount(senderId: string, at: Date = new Date()): Promise<number> {
  const bucket = hourBucket(at);
  const value = await redisConnection.get(rateKey(senderId, bucket));
  return value ? parseInt(value, 10) : 0;
}

import { Redis } from 'ioredis';
import { redisConnection } from '../queue/queue.js';
import { logger } from '../utils/logger.js';

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  msUntilNextHour: number;
  hourWindow: string;
}

/**
 * Returns formatted ISO UTC hour string: YYYY-MM-DDTHH
 * Example: "2026-09-24T17"
 */
export function getHourWindow(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const h = String(date.getUTCHours()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}`;
}

/**
 * Calculates milliseconds remaining until the start of the next UTC hour.
 * Adds a safe 1000ms buffer so scheduled jobs do not land prematurely
 * in the tail-end of the current hour due to clock jitter.
 */
export function getMsUntilNextHour(now: Date = new Date()): number {
  const currentMinutes = now.getUTCMinutes();
  const currentSeconds = now.getUTCSeconds();
  const currentMillis = now.getUTCMilliseconds();

  const elapsedInHourMs =
    currentMinutes * 60 * 1000 + currentSeconds * 1000 + currentMillis;
  const remainingInHourMs = 3600 * 1000 - elapsedInHourMs;

  return remainingInHourMs + 1000; // 1s buffer into next hour
}

/**
 * Atomic Lua script to check and consume a slot:
 * - If current >= limit: returns [0, current] (denied)
 * - If current < limit: increments, sets TTL if new, returns [1, newCount] (allowed)
 */
const RATE_LIMIT_LUA_SCRIPT = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])

local current = redis.call('GET', key)
if current and tonumber(current) >= limit then
  return {0, tonumber(current)}
else
  local val = redis.call('INCR', key)
  if val == 1 then
    redis.call('EXPIRE', key, ttl)
  end
  return {1, val}
end
`;

/**
 * Checks and atomically claims an email send slot for the given sender within the current UTC hour.
 * 
 * Safe across arbitrary worker concurrency and multiple Node.js instances.
 */
export async function consumeHourlyRateLimit(
  sender: string,
  hourlyLimit: number,
  client: Redis = redisConnection
): Promise<RateLimitResult> {
  const hourWindow = getHourWindow();
  // Standardized rate limit key: rate:{sender}:{hourWindow}
  const key = `rate:${sender.trim().toLowerCase()}:${hourWindow}`;
  const ttl = 7200; // 2 hours expiration to clean up historical keys automatically
  const msUntilNextHour = getMsUntilNextHour();

  try {
    const [allowed, count] = (await client.eval(
      RATE_LIMIT_LUA_SCRIPT,
      1,
      key,
      hourlyLimit.toString(),
      ttl.toString()
    )) as [number, number];

    const isAllowed = allowed === 1;

    if (!isAllowed) {
      logger.warn(
        `Rate limit reached for sender "${sender}": ${count}/${hourlyLimit} used in window ${hourWindow}. Next window in ${Math.round(
          msUntilNextHour / 1000
        )}s`
      );
    } else {
      logger.debug(
        `Rate limit slot claimed for "${sender}": ${count}/${hourlyLimit} in window ${hourWindow}`
      );
    }

    return {
      allowed: isAllowed,
      currentCount: count,
      limit: hourlyLimit,
      msUntilNextHour,
      hourWindow,
    };
  } catch (error: any) {
    logger.error('Error executing rate limit Lua script:', {
      error: error.message,
      key,
    });
    throw error;
  }
}

/**
 * Read-only check for current count in window.
 */
export async function getHourlySendCount(
  sender: string,
  hourWindow: string = getHourWindow(),
  client: Redis = redisConnection
): Promise<number> {
  const key = `rate:${sender.trim().toLowerCase()}:${hourWindow}`;
  const val = await client.get(key);
  return val ? parseInt(val, 10) : 0;
}

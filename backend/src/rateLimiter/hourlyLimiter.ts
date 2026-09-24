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

export function getHourWindow(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const h = String(date.getUTCHours()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}`;
}

export function getMsUntilNextHour(now: Date = new Date()): number {
  const mins = now.getUTCMinutes();
  const secs = now.getUTCSeconds();
  const ms = now.getUTCMilliseconds();

  const elapsed = mins * 60 * 1000 + secs * 1000 + ms;
  return 3600 * 1000 - elapsed + 1000;
}

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

export async function consumeHourlyRateLimit(
  sender: string,
  hourlyLimit: number,
  client: Redis = redisConnection
): Promise<RateLimitResult> {
  const hourWindow = getHourWindow();
  const key = `rate:${sender.trim().toLowerCase()}:${hourWindow}`;
  const ttl = 7200;
  const msUntilNextHour = getMsUntilNextHour();

  try {
    const [allowed, count] = (await client.eval(
      RATE_LIMIT_LUA_SCRIPT,
      1,
      key,
      hourlyLimit.toString(),
      ttl.toString()
    )) as [number, number];

    return {
      allowed: allowed === 1,
      currentCount: count,
      limit: hourlyLimit,
      msUntilNextHour,
      hourWindow,
    };
  } catch (error: any) {
    logger.error('Rate limit evaluation error:', { error: error.message, key });
    throw error;
  }
}

export async function getHourlySendCount(
  sender: string,
  hourWindow: string = getHourWindow(),
  client: Redis = redisConnection
): Promise<number> {
  const key = `rate:${sender.trim().toLowerCase()}:${hourWindow}`;
  const val = await client.get(key);
  return val ? parseInt(val, 10) : 0;
}

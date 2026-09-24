import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { redisConnection } from '../queue/queue.js';
import {
  consumeHourlyRateLimit,
  getHourWindow,
  getHourlySendCount,
} from '../rateLimiter/hourlyLimiter.js';

describe('Redis Hourly Rate Limiter', () => {
  const testSender = `test-sender-${Date.now()}@reachinbox.ai`;
  const hourWindow = getHourWindow();
  const rateLimitKey = `rate:${testSender}:${hourWindow}`;

  afterAll(async () => {
    await redisConnection.del(rateLimitKey);
    await redisConnection.quit();
  });

  it('correctly formats the UTC hour window string', () => {
    const fixedDate = new Date('2026-09-24T17:35:00.000Z');
    expect(getHourWindow(fixedDate)).toBe('2026-09-24T17');
  });

  it('allows sends when under the configured limit', async () => {
    const limit = 3;

    const r1 = await consumeHourlyRateLimit(testSender, limit);
    expect(r1.allowed).toBe(true);
    expect(r1.currentCount).toBe(1);

    const r2 = await consumeHourlyRateLimit(testSender, limit);
    expect(r2.allowed).toBe(true);
    expect(r2.currentCount).toBe(2);

    const r3 = await consumeHourlyRateLimit(testSender, limit);
    expect(r3.allowed).toBe(true);
    expect(r3.currentCount).toBe(3);
  });

  it('rejects further sends and returns ms until next hour when limit is reached', async () => {
    const limit = 3;

    // 4th attempt should be rejected
    const r4 = await consumeHourlyRateLimit(testSender, limit);
    expect(r4.allowed).toBe(false);
    expect(r4.currentCount).toBe(3); // Lua script leaves count at limit
    expect(r4.msUntilNextHour).toBeGreaterThan(0);
    expect(r4.msUntilNextHour).toBeLessThanOrEqual(3601 * 1000);
  });

  it('verifies that Redis counter is persisted and matches getHourlySendCount', async () => {
    const count = await getHourlySendCount(testSender, hourWindow);
    expect(count).toBe(3);
  });
});

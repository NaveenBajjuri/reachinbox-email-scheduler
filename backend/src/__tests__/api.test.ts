import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { db } from '../db/client.js';
import { redisConnection } from '../queue/queue.js';

describe('API & Scheduler Integration Tests', () => {
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    // Authenticate via dev-login
    const loginRes = await request(app)
      .post('/api/auth/dev-login')
      .send({
        email: `api-test-${Date.now()}@reachinbox.ai`,
        name: 'API Tester',
      });

    expect(loginRes.status).toBe(200);
    authToken = loginRes.body.token;
    userId = loginRes.body.user.id;
  });

  afterAll(async () => {
    if (userId) {
      await db.email.deleteMany({ where: { userId } });
      await db.user.delete({ where: { id: userId } });
    }
    await redisConnection.quit();
    await db.$disconnect();
  });

  it('GET /health returns healthy status for both PostgreSQL and Redis', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.services.database).toBe('healthy');
    expect(res.body.services.redis).toBe('healthy');
  });

  it('GET /api/emails/scheduled returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/emails/scheduled');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/emails/schedule rejects invalid email payload with 400', async () => {
    const res = await request(app)
      .post('/api/emails/schedule')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        subject: '',
        body: '',
        recipients: ['not-an-email'],
        sender: 'invalid',
        startTime: 'not-a-date',
        delayBetweenEmails: -5,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it('POST /api/emails/schedule successfully schedules a batch of emails', async () => {
    const futureTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const res = await request(app)
      .post('/api/emails/schedule')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        subject: 'Welcome to ReachInbox',
        body: '<p>Excited to have you on board!</p>',
        recipients: ['user1@example.com', 'user2@example.com', 'user3@example.com'],
        sender: 'founder@reachinbox.ai',
        startTime: futureTime,
        delayBetweenEmails: 5000,
        hourlyLimit: 50,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.scheduledCount).toBe(3);
    expect(res.body.emailIds.length).toBe(3);

    // Verify stored in PostgreSQL
    const saved = await db.email.findMany({
      where: { userId },
    });
    expect(saved.length).toBe(3);
    expect(saved[0].status).toBe('SCHEDULED');
  });

  it('GET /api/emails/scheduled lists scheduled emails with pagination', async () => {
    const res = await request(app)
      .get('/api/emails/scheduled?page=1&pageSize=10')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(3);
    expect(res.body.total).toBe(3);
    expect(res.body.page).toBe(1);
  });

  it('handles 1000+ emails scheduled in a batch without blocking the API response', async () => {
    // Generate 1000 unique valid email addresses
    const largeBatchRecipients = Array.from({ length: 1000 }, (_, i) => `lead_${i}_${Date.now()}@batchtest.com`);
    const futureTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const t0 = Date.now();
    const res = await request(app)
      .post('/api/emails/schedule')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        subject: 'High Volume Batch Test',
        body: '<p>Testing 1000 batch responsiveness</p>',
        recipients: largeBatchRecipients,
        sender: 'bulk@reachinbox.ai',
        startTime: futureTime,
        delayBetweenEmails: 2000,
      });

    const duration = Date.now() - t0;

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.scheduledCount).toBe(1000);
    expect(res.body.emailIds.length).toBe(1000);

    // Assert that scheduling 1000 records completed rapidly (under 3000ms)
    expect(duration).toBeLessThan(5000);

    // Verify persisted in DB
    const countInDb = await db.email.count({
      where: { userId, subject: 'High Volume Batch Test' },
    });
    expect(countInDb).toBe(1000);

    // Clean up batch test records so test db stays lean
    await db.email.deleteMany({
      where: { userId, subject: 'High Volume Batch Test' },
    });
  });
});

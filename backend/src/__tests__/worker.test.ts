import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { EmailStatus } from '@prisma/client';
import { db } from '../db/client.js';
import { redisConnection } from '../queue/queue.js';
import { processEmailJob } from '../queue/worker.js';
import { Job } from 'bullmq';

describe('Worker & Idempotency Engine', () => {
  let testUserId: string;

  beforeAll(async () => {
    const user = await db.user.create({
      data: {
        googleId: `test-worker-user-${Date.now()}`,
        name: 'Worker Test User',
        email: `worker-user-${Date.now()}@test.com`,
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    await db.email.deleteMany({ where: { userId: testUserId } });
    await db.user.delete({ where: { id: testUserId } });
    await redisConnection.quit();
    await db.$disconnect();
  });

  it('prevents duplicate execution when email is already in SENT status', async () => {
    const email = await db.email.create({
      data: {
        userId: testUserId,
        recipient: 'already-sent@test.com',
        subject: 'Already Sent Subject',
        body: '<p>Body</p>',
        sender: 'sender@test.com',
        scheduledAt: new Date(),
        sentAt: new Date(),
        status: EmailStatus.SENT,
      },
    });

    const mockJob = {
      id: email.id,
      data: { emailId: email.id },
    } as unknown as Job;

    await processEmailJob(mockJob);

    // Verify DB was untouched
    const freshEmail = await db.email.findUnique({ where: { id: email.id } });
    expect(freshEmail?.status).toBe(EmailStatus.SENT);
    expect(freshEmail?.attempts).toBe(0);
  });

  it('atomically claims SCHEDULED record so second concurrent worker is rejected', async () => {
    const email = await db.email.create({
      data: {
        userId: testUserId,
        recipient: 'concurrent@test.com',
        subject: 'Concurrent Test',
        body: '<p>Concurrent</p>',
        sender: 'concurrent@test.com',
        scheduledAt: new Date(),
        status: EmailStatus.SCHEDULED,
      },
    });

    // Simulate Worker 1 claiming the email
    const claim1 = await db.email.updateMany({
      where: { id: email.id, status: EmailStatus.SCHEDULED },
      data: { status: EmailStatus.PROCESSING, attempts: { increment: 1 } },
    });

    // Simulate Worker 2 attempting to claim the same email concurrently
    const claim2 = await db.email.updateMany({
      where: { id: email.id, status: EmailStatus.SCHEDULED },
      data: { status: EmailStatus.PROCESSING, attempts: { increment: 1 } },
    });

    expect(claim1.count).toBe(1); // Worker 1 won the claim
    expect(claim2.count).toBe(0); // Worker 2 lost and was denied processing

    const claimedEmail = await db.email.findUnique({ where: { id: email.id } });
    expect(claimedEmail?.status).toBe(EmailStatus.PROCESSING);
    expect(claimedEmail?.attempts).toBe(1);
  });

  it('processes an email job, sends via Ethereal, and marks DB status as SENT', async () => {
    const email = await db.email.create({
      data: {
        userId: testUserId,
        recipient: 'ethereal-receiver@test.com',
        subject: 'Live Send Test',
        body: '<p>Testing Ethereal Delivery</p>',
        sender: 'scheduler-test@reachinbox.ai',
        scheduledAt: new Date(),
        status: EmailStatus.SCHEDULED,
      },
    });

    const mockJob = {
      id: email.id,
      data: { emailId: email.id },
    } as unknown as Job;

    await processEmailJob(mockJob);

    const updated = await db.email.findUnique({ where: { id: email.id } });
    expect(updated?.status).toBe(EmailStatus.SENT);
    expect(updated?.sentAt).not.toBeNull();
    expect(updated?.attempts).toBe(1);
    expect(updated?.errorMessage).toBeNull();
  });
});

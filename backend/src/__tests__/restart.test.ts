import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { EmailStatus } from '@prisma/client';
import { db } from '../db/client.js';
import { emailQueue, redisConnection } from '../queue/queue.js';
import { createWorker } from '../queue/worker.js';
import { scheduleEmails } from '../services/scheduler.service.js';
import { Worker } from 'bullmq';

describe('Server/Worker Restart Persistence Verification', () => {
  let testUserId: string;

  beforeAll(async () => {
    // Drain any leftover jobs from previous tests
    try {
      await emailQueue.drain(true);
    } catch {
      // ignore
    }

    const user = await db.user.create({
      data: {
        googleId: `restart-user-${Date.now()}`,
        name: 'Restart Persistence Tester',
        email: `restart-tester-${Date.now()}@test.com`,
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    if (testUserId) {
      await db.email.deleteMany({ where: { userId: testUserId } });
      await db.user.delete({ where: { id: testUserId } });
    }
    await redisConnection.quit();
    await db.$disconnect();
  });

  it('persists a future delayed job across worker process stop and restart', async () => {
    // 1. Schedule an email 4 seconds into the future
    const delayMs = 4000;
    const futureSendTime = new Date(Date.now() + delayMs).toISOString();

    const scheduleResult = await scheduleEmails(testUserId, {
      subject: 'Surviving Process Restart',
      body: '<p>Verifying Redis/BullMQ persistence across server downtime</p>',
      recipients: ['restart-recipient@test.com'],
      sender: 'scheduler-restart@reachinbox.ai',
      startTime: futureSendTime,
      delayBetweenEmails: 0,
    });

    expect(scheduleResult.success).toBe(true);
    const emailId = scheduleResult.emailIds[0];

    // 2. Verify stored as SCHEDULED in PostgreSQL
    const emailBefore = await db.email.findUnique({ where: { id: emailId } });
    expect(emailBefore?.status).toBe(EmailStatus.SCHEDULED);

    // 3. Verify delayed job exists in Redis via BullMQ
    const delayedJob = await emailQueue.getJob(emailId);
    expect(delayedJob).not.toBeNull();
    expect(delayedJob?.id).toBe(emailId);
    const jobStateBefore = await delayedJob?.getState();
    expect(jobStateBefore).toBe('delayed');

    // 4. SIMULATE COMPLETE WORKER SHUTDOWN (Zero active workers running)
    // We intentionally do not have any worker running right now.
    // Wait for 1.5 seconds during complete worker outage
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Verify status is STILL SCHEDULED during outage
    const emailDuringOutage = await db.email.findUnique({ where: { id: emailId } });
    expect(emailDuringOutage?.status).toBe(EmailStatus.SCHEDULED);

    // 5. SIMULATE SERVER / WORKER RESTART
    // Spin up a brand-new worker instance as would happen after service reboot
    const restartedWorker: Worker = createWorker(1);

    // 6. Wait for the scheduled time to arrive and for the restarted worker to process the job
    const completedPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timed out waiting for restarted worker to process delayed job'));
      }, 15000);

      restartedWorker.on('completed', (job) => {
        if (job.data.emailId === emailId) {
          clearTimeout(timeout);
          resolve();
        }
      });

      restartedWorker.on('failed', (job, err) => {
        if (job?.data?.emailId === emailId) {
          clearTimeout(timeout);
          reject(err);
        }
      });
    });

    await completedPromise;

    // 7. Verify final state in PostgreSQL
    const emailAfterRestart = await db.email.findUnique({ where: { id: emailId } });
    expect(emailAfterRestart?.status).toBe(EmailStatus.SENT);
    expect(emailAfterRestart?.sentAt).not.toBeNull();
    expect(emailAfterRestart?.attempts).toBe(1);

    // Clean up restarted worker
    await restartedWorker.close();
  });
});

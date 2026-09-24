import { Worker, Job } from 'bullmq';
import { EmailStatus } from '@prisma/client';
import { db } from '../db/client.js';
import { env } from '../config/env.js';
import { EMAIL_QUEUE_NAME, createRedisConnection, emailQueue } from './queue.js';
import { EmailJobData } from '../types/index.js';
import { consumeHourlyRateLimit } from '../rateLimiter/hourlyLimiter.js';
import { sendEmail } from '../services/email.service.js';
import { logger } from '../utils/logger.js';

export async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { emailId } = job.data;

  const email = await db.email.findUnique({
    where: { id: emailId },
  });

  if (!email) {
    logger.warn(`Email record ${emailId} not found`);
    return;
  }

  if (email.status === EmailStatus.SENT) {
    return;
  }

  if (email.status === EmailStatus.FAILED && email.attempts >= 3) {
    return;
  }

  const claim = await db.email.updateMany({
    where: {
      id: emailId,
      status: EmailStatus.SCHEDULED,
    },
    data: {
      status: EmailStatus.PROCESSING,
      attempts: { increment: 1 },
    },
  });

  if (claim.count === 0) {
    return;
  }

  const hourlyLimit = env.DEFAULT_HOURLY_LIMIT;
  const rateResult = await consumeHourlyRateLimit(email.sender, hourlyLimit);

  if (!rateResult.allowed) {
    const nextWindow = new Date(Date.now() + rateResult.msUntilNextHour);

    await db.email.update({
      where: { id: emailId },
      data: {
        status: EmailStatus.SCHEDULED,
        scheduledAt: nextWindow,
      },
    });

    await emailQueue.add(
      'send-email',
      { emailId },
      {
        delay: rateResult.msUntilNextHour,
        jobId: `${emailId}-rescheduled-${nextWindow.getTime()}`,
      }
    );

    return;
  }

  try {
    const result = await sendEmail({
      to: email.recipient,
      subject: email.subject,
      body: email.body,
      sender: email.sender,
    });

    await db.email.update({
      where: { id: emailId },
      data: {
        status: EmailStatus.SENT,
        sentAt: new Date(),
        errorMessage: null,
      },
    });

    logger.info(`Email delivered to ${email.recipient}`, { messageId: result.messageId });
  } catch (err: any) {
    const freshRecord = await db.email.findUnique({ where: { id: emailId } });
    const currentAttempts = freshRecord?.attempts ?? 1;

    if (currentAttempts >= 3) {
      await db.email.update({
        where: { id: emailId },
        data: {
          status: EmailStatus.FAILED,
          errorMessage: err.message || 'SMTP delivery failed',
        },
      });
    } else {
      await db.email.update({
        where: { id: emailId },
        data: {
          status: EmailStatus.SCHEDULED,
          errorMessage: `Attempt ${currentAttempts} failed: ${err.message}`,
        },
      });
    }

    throw err;
  }
}

export function createWorker(concurrency: number = env.WORKER_CONCURRENCY): Worker<EmailJobData, void, string> {
  const connection = createRedisConnection();

  const worker = new Worker<EmailJobData, void, string>(
    EMAIL_QUEUE_NAME,
    async (job) => {
      await processEmailJob(job);
    },
    {
      connection,
      concurrency,
      limiter: {
        max: 50,
        duration: 1000,
      },
    }
  );

  worker.on('failed', (job, err) => {
    logger.error(`Job ${job?.id} failed:`, { error: err.message });
  });

  return worker;
}

import { Worker, Job } from 'bullmq';
import { EmailStatus } from '@prisma/client';
import { db } from '../db/client.js';
import { env } from '../config/env.js';
import { EMAIL_QUEUE_NAME, createRedisConnection, emailQueue } from './queue.js';
import { EmailJobData } from '../types/index.js';
import { consumeHourlyRateLimit } from '../rateLimiter/hourlyLimiter.js';
import { sendEmail } from '../services/email.service.js';
import { logger } from '../utils/logger.js';

/**
 * Theoretical Crash Window Note:
 * In any distributed architecture where an external side-effect (SMTP send) is decoupled
 * from the database transaction, there is a theoretical crash window:
 * 1. Ethereal/SMTP succeeds and delivers the message.
 * 2. Process crashes or hardware loses power before the DB UPDATE to 'SENT' completes.
 * 3. On restart, the job might be retried.
 * 
 * To mitigate this:
 * 1. We atomically transition status from SCHEDULED -> PROCESSING before attempting the send.
 * 2. Any duplicate worker invocation while the job is PROCESSING is rejected (claim.count === 0).
 * 3. In enterprise systems, mail servers support idempotency-keys or Message-ID headers to de-duplicate
 *    on the SMTP side. Here, our atomic claim pattern ensures no two workers concurrently process
 *    the same email, and already-sent emails are permanently ignored.
 */

export async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { emailId } = job.data;
  logger.info(`[Worker] Processing job ${job.id} for email ${emailId}`);

  // 1. Fetch current email record from PostgreSQL (Durable Source of Truth)
  const email = await db.email.findUnique({
    where: { id: emailId },
  });

  if (!email) {
    logger.warn(`[Worker] Email record ${emailId} not found in database. Skipping.`);
    return;
  }

  // 2. Check current status - Idempotency Guard
  if (email.status === EmailStatus.SENT) {
    logger.info(`[Worker] Email ${emailId} already marked as SENT. Skipping duplicate send.`);
    return;
  }

  if (email.status === EmailStatus.FAILED && email.attempts >= 3) {
    logger.info(`[Worker] Email ${emailId} has already exhausted attempts with status FAILED. Skipping.`);
    return;
  }

  // 3. Atomic Claim: Transition status from SCHEDULED -> PROCESSING
  // This prevents any concurrent worker from picking up and sending this email simultaneously.
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
    // If count is 0, another worker already claimed it or it is no longer SCHEDULED
    logger.warn(`[Worker] Atomic claim failed for email ${emailId}. Already claimed or updated by another worker.`);
    return;
  }

  // 4. Rate Limiting Check (Redis-backed, cross-worker safe)
  const hourlyLimit = env.DEFAULT_HOURLY_LIMIT;
  const rateResult = await consumeHourlyRateLimit(email.sender, hourlyLimit);

  if (!rateResult.allowed) {
    // Exceeded hourly limit!
    // Non-negotiable constraint: NEVER drop or permanently fail the email. Reschedule into next window.
    const rescheduledAt = new Date(Date.now() + rateResult.msUntilNextHour);

    logger.warn(
      `[Worker] Hourly limit (${hourlyLimit}) reached for sender "${email.sender}". Rescheduling email ${emailId} for ${rescheduledAt.toISOString()}`
    );

    // Revert status to SCHEDULED in DB with new scheduledAt
    await db.email.update({
      where: { id: emailId },
      data: {
        status: EmailStatus.SCHEDULED,
        scheduledAt: rescheduledAt,
      },
    });

    // Enqueue delayed BullMQ job for next hour
    await emailQueue.add(
      'send-email',
      { emailId },
      {
        delay: rateResult.msUntilNextHour,
        jobId: `${emailId}-rescheduled-${rescheduledAt.getTime()}`,
      }
    );

    return;
  }

  // 5. Send via Ethereal SMTP
  try {
    const result = await sendEmail({
      to: email.recipient,
      subject: email.subject,
      body: email.body,
      sender: email.sender,
    });

    // 6. Update database to SENT
    await db.email.update({
      where: { id: emailId },
      data: {
        status: EmailStatus.SENT,
        sentAt: new Date(),
        errorMessage: null,
      },
    });

    logger.info(`[Worker] Successfully sent and updated email ${emailId} (MessageId: ${result.messageId})`);
  } catch (error: any) {
    logger.error(`[Worker] Failed to send email ${emailId}:`, { error: error.message });

    // Update status to FAILED or revert to SCHEDULED if retries remain
    const updatedEmail = await db.email.findUnique({ where: { id: emailId } });
    const currentAttempts = updatedEmail?.attempts ?? 1;

    if (currentAttempts >= 3) {
      await db.email.update({
        where: { id: emailId },
        data: {
          status: EmailStatus.FAILED,
          errorMessage: error.message || 'SMTP transmission failure',
        },
      });
    } else {
      // Revert to SCHEDULED for BullMQ retry
      await db.email.update({
        where: { id: emailId },
        data: {
          status: EmailStatus.SCHEDULED,
          errorMessage: `Attempt ${currentAttempts} failed: ${error.message}`,
        },
      });
    }

    throw error; // Let BullMQ apply backoff retry
  }
}

export function createWorker(concurrency: number = env.WORKER_CONCURRENCY): Worker<EmailJobData, void, string> {
  const workerRedis = createRedisConnection();

  const worker = new Worker<EmailJobData, void, string>(
    EMAIL_QUEUE_NAME,
    async (job) => {
      await processEmailJob(job);
    },
    {
      connection: workerRedis,
      concurrency,
      limiter: {
        max: 50,
        duration: 1000,
      },
    }
  );

  worker.on('completed', (job) => {
    logger.debug(`[Worker] Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`[Worker] Job ${job?.id} failed:`, { error: err.message });
  });

  worker.on('error', (err) => {
    logger.error('[Worker] Worker internal error:', { error: err.message });
  });

  logger.info(`BullMQ Worker started with concurrency: ${concurrency}`);
  return worker;
}

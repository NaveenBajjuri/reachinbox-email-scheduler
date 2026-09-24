import { randomUUID } from 'crypto';
import { EmailStatus } from '@prisma/client';
import { db } from '../db/client.js';
import { emailQueue } from '../queue/queue.js';
import { ScheduleEmailRequest, ScheduleEmailResponse } from '../types/index.js';
import { logger } from '../utils/logger.js';

export async function scheduleEmails(
  userId: string,
  request: ScheduleEmailRequest
): Promise<ScheduleEmailResponse> {
  const {
    subject,
    body,
    recipients,
    sender,
    startTime,
    delayBetweenEmails = 0,
  } = request;

  const baseStartTimeMs = new Date(startTime).getTime();
  const nowMs = Date.now();

  logger.info(`Scheduling batch of ${recipients.length} emails for user ${userId}`);

  // 1. Prepare DB records with pre-generated UUIDs
  // This allows lightning-fast bulk insertion while retaining exact IDs for BullMQ jobs
  const emailRecords = recipients.map((recipient, index) => {
    const id = randomUUID();
    const sendAtMs = baseStartTimeMs + index * delayBetweenEmails;
    const scheduledAt = new Date(Math.max(nowMs, sendAtMs));

    return {
      id,
      userId,
      recipient: recipient.trim().toLowerCase(),
      subject,
      body,
      sender: sender.trim(),
      scheduledAt,
      status: EmailStatus.SCHEDULED,
      attempts: 0,
      errorMessage: null,
    };
  });

  // 2. Perform bulk insertion into PostgreSQL
  // Single database round-trip even for 1000+ items
  await db.email.createMany({
    data: emailRecords,
  });

  logger.info(`Persisted ${emailRecords.length} email records in PostgreSQL`);

  // 3. Prepare BullMQ delayed jobs with deterministic job IDs (jobId = email.id)
  const jobsToEnqueue = emailRecords.map((record) => {
    const targetSendTimeMs = record.scheduledAt.getTime();
    const delay = Math.max(0, targetSendTimeMs - Date.now());

    return {
      name: 'send-email',
      data: {
        emailId: record.id,
      },
      opts: {
        delay,
        jobId: record.id, // Natural idempotency key: BullMQ rejects duplicates with the same jobId
      },
    };
  });

  // 4. Batch enqueue into Redis using BullMQ's addBulk (single pipeline)
  // Ensures the API remains responsive within milliseconds even under heavy batch loads
  const CHUNK_SIZE = 500;
  for (let i = 0; i < jobsToEnqueue.length; i += CHUNK_SIZE) {
    const chunk = jobsToEnqueue.slice(i, i + CHUNK_SIZE);
    await emailQueue.addBulk(chunk);
  }

  logger.info(`Enqueued ${jobsToEnqueue.length} delayed jobs in BullMQ`);

  return {
    success: true,
    scheduledCount: emailRecords.length,
    message: `Successfully scheduled ${emailRecords.length} email(s)`,
    emailIds: emailRecords.map((r) => r.id),
  };
}

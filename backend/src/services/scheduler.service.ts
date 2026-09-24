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

  const startMs = new Date(startTime).getTime();
  const now = Date.now();

  const records = recipients.map((recipient, i) => {
    const id = randomUUID();
    const scheduledMs = startMs + i * delayBetweenEmails;
    const scheduledAt = new Date(Math.max(now, scheduledMs));

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

  await db.email.createMany({ data: records });

  const jobs = records.map((record) => {
    const delay = Math.max(0, record.scheduledAt.getTime() - Date.now());

    return {
      name: 'send-email',
      data: { emailId: record.id },
      opts: {
        delay,
        jobId: record.id,
      },
    };
  });

  const BATCH_SIZE = 500;
  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const chunk = jobs.slice(i, i + BATCH_SIZE);
    await emailQueue.addBulk(chunk);
  }

  logger.info(`Scheduled ${records.length} emails for user ${userId}`);

  return {
    success: true,
    scheduledCount: records.length,
    message: `Successfully scheduled ${records.length} email(s)`,
    emailIds: records.map((r) => r.id),
  };
}

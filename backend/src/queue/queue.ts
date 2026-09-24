import { Queue, QueueOptions } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { EmailJobData } from '../types/index.js';
import { logger } from '../utils/logger.js';

export const EMAIL_QUEUE_NAME = 'email-queue';

export function createRedisConnection(): Redis {
  const redis = new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    retryStrategy(times) {
      const delay = Math.min(times * 100, 3000);
      logger.warn(`Redis connection retry attempt ${times}, delaying ${delay}ms`);
      return delay;
    },
  });

  redis.on('error', (err) => {
    logger.error('Redis connection error:', { message: err.message });
  });

  return redis;
}

export const redisConnection = createRedisConnection();

const queueOptions: QueueOptions = {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
};

export const emailQueue = new Queue<EmailJobData, void, string>(
  EMAIL_QUEUE_NAME,
  queueOptions
);

logger.info(`BullMQ Queue "${EMAIL_QUEUE_NAME}" initialized`);

import { createWorker } from './queue/worker.js';
import { logger } from './utils/logger.js';
import { db } from './db/client.js';

logger.info('Starting ReachInbox standalone worker process...');

const worker = createWorker();

const shutdown = async () => {
  logger.info('Gracefully shutting down worker...');
  await worker.close();
  await db.$disconnect();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { db } from './db/client.js';
import { redisConnection } from './queue/queue.js';
import { createWorker } from './queue/worker.js';
import authRoutes from './api/auth.routes.js';
import scheduleRoutes from './api/schedule.routes.js';
import { logger } from './utils/logger.js';

const app = express();

// Middlewares
app.use(
  cors({
    origin: [env.FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check Endpoint
app.get('/health', async (req: Request, res: Response) => {
  let dbStatus = 'down';
  let redisStatus = 'down';

  try {
    await db.$queryRaw`SELECT 1`;
    dbStatus = 'healthy';
  } catch (err: any) {
    dbStatus = `unhealthy: ${err.message}`;
  }

  try {
    const pong = await redisConnection.ping();
    if (pong === 'PONG') redisStatus = 'healthy';
  } catch (err: any) {
    redisStatus = `unhealthy: ${err.message}`;
  }

  const isHealthy = dbStatus === 'healthy' && redisStatus === 'healthy';

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus,
      redis: redisStatus,
    },
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/emails', scheduleRoutes);

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled server error:', {
    message: err.message,
    stack: env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  res.status(500).json({
    success: false,
    error: 'An internal server error occurred',
  });
});

// Start Worker (in-process for development simplicity, or disabled if running standalone worker)
let worker: ReturnType<typeof createWorker> | null = null;
if (process.env.RUN_WORKER !== 'false' && process.env.NODE_ENV !== 'test') {
  worker = createWorker();
}

let server: any = null;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(env.PORT, () => {
    logger.info(`ReachInbox Email Scheduler Backend running on http://localhost:${env.PORT}`);
    logger.info(`Environment: ${env.NODE_ENV}`);
  });

  const handleShutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    if (server) {
      server.close(async () => {
        logger.info('HTTP server closed');

        if (worker) {
          await worker.close();
          logger.info('BullMQ worker closed');
        }

        await redisConnection.quit();
        logger.info('Redis connection closed');

        await db.$disconnect();
        logger.info('Database connection closed');

        process.exit(0);
      });
    }

    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

export default app;

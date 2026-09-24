import { Router, Response } from 'express';
import { z } from 'zod';
import { EmailStatus } from '@prisma/client';
import { db } from '../db/client.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { validateBody, validateQuery } from '../middleware/validate.middleware.js';
import { scheduleEmails } from '../services/scheduler.service.js';
import { logger } from '../utils/logger.js';

const router = Router();

const scheduleSchema = z.object({
  subject: z.string().min(1, 'Subject cannot be empty').max(255),
  body: z.string().min(1, 'Email body cannot be empty'),
  recipients: z
    .array(z.string().email('Invalid email address format'))
    .min(1, 'At least one recipient is required'),
  sender: z.string().email('Sender must be a valid email address'),
  startTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'startTime must be a valid ISO date string',
  }),
  delayBetweenEmails: z.number().nonnegative('delayBetweenEmails must be >= 0'),
  hourlyLimit: z.number().int().positive('hourlyLimit must be a positive integer').optional(),
});

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

router.post(
  '/schedule',
  requireAuth,
  validateBody(scheduleSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const result = await scheduleEmails(user.id, req.body);
      res.status(201).json(result);
    } catch (error: any) {
      logger.error('Failed to schedule emails:', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to schedule emails',
      });
    }
  }
);

router.get(
  '/scheduled',
  requireAuth,
  validateQuery(paginationQuerySchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const page = Number(req.query.page) || 1;
      const pageSize = Number(req.query.pageSize) || 20;
      const skip = (page - 1) * pageSize;

      const where = {
        userId: user.id,
        status: { in: [EmailStatus.SCHEDULED, EmailStatus.PROCESSING] },
      };

      const [total, emails] = await Promise.all([
        db.email.count({ where }),
        db.email.findMany({
          where,
          orderBy: { scheduledAt: 'asc' },
          skip,
          take: pageSize,
        }),
      ]);

      res.json({
        data: emails,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      });
    } catch (error: any) {
      logger.error('Failed to list scheduled emails:', { error: error.message });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

router.get(
  '/sent',
  requireAuth,
  validateQuery(paginationQuerySchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const page = Number(req.query.page) || 1;
      const pageSize = Number(req.query.pageSize) || 20;
      const skip = (page - 1) * pageSize;

      const where = {
        userId: user.id,
        status: { in: [EmailStatus.SENT, EmailStatus.FAILED] },
      };

      const [total, emails] = await Promise.all([
        db.email.count({ where }),
        db.email.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          skip,
          take: pageSize,
        }),
      ]);

      res.json({
        data: emails,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      });
    } catch (error: any) {
      logger.error('Failed to list sent emails:', { error: error.message });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

router.get(
  '/:id',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;

      const email = await db.email.findFirst({
        where: {
          id,
          userId: user.id,
        },
      });

      if (!email) {
        res.status(404).json({ success: false, error: 'Email record not found' });
        return;
      }

      res.json({ success: true, email });
    } catch (error: any) {
      logger.error(`Failed to fetch email ${req.params.id}:`, { error: error.message });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

export default router;

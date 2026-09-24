import { Router, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { db } from '../db/client.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { logger } from '../utils/logger.js';
import { z } from 'zod';
import { validateBody } from '../middleware/validate.middleware.js';

const router = Router();

function getOAuth2Client(): OAuth2Client {
  return new OAuth2Client(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_CALLBACK_URL
  );
}

router.get('/google', (req: Request, res: Response) => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    res.status(503).json({
      success: false,
      error: 'Google OAuth credentials missing in configuration',
    });
    return;
  }

  const client = getOAuth2Client();
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    prompt: 'consent',
  });

  res.redirect(url);
});

router.get('/google/callback', async (req: Request, res: Response) => {
  const { code, error } = req.query;

  if (error) {
    logger.warn('Google auth denied:', { error });
    res.redirect(`${env.FRONTEND_URL}/login?error=${encodeURIComponent(String(error))}`);
    return;
  }

  if (!code || typeof code !== 'string') {
    res.status(400).json({ success: false, error: 'Missing auth code' });
    return;
  }

  try {
    const client = getOAuth2Client();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    if (!tokens.id_token) {
      throw new Error('Missing id_token from Google exchange');
    }

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload?.email || !payload?.sub) {
      throw new Error('Invalid Google payload');
    }

    const user = await db.user.upsert({
      where: { googleId: payload.sub },
      update: {
        name: payload.name || payload.email.split('@')[0],
        email: payload.email,
        avatarUrl: payload.picture || null,
      },
      create: {
        googleId: payload.sub,
        name: payload.name || payload.email.split('@')[0],
        email: payload.email,
        avatarUrl: payload.picture || null,
      },
    });

    const token = jwt.sign({ userId: user.id }, env.JWT_SECRET, {
      expiresIn: '7d',
    });

    res.cookie('token', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.redirect(`${env.FRONTEND_URL}/dashboard`);
  } catch (err: any) {
    logger.error('OAuth callback failed:', { error: err.message });
    res.redirect(`${env.FRONTEND_URL}/login?error=oauth_failed`);
  }
});

router.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, user: req.user });
});

router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out successfully' });
});

const devLoginSchema = z.object({
  email: z.string().email(),
  name: z.string().optional().default('Dev Tester'),
  avatarUrl: z.string().optional().default('https://api.dicebear.com/7.x/avataaars/svg?seed=ReachInbox'),
});

router.post(
  '/dev-login',
  validateBody(devLoginSchema),
  async (req: Request, res: Response) => {
    const { email, name, avatarUrl } = req.body;
    const googleId = `dev-user-${email}`;

    const user = await db.user.upsert({
      where: { googleId },
      update: { name, email, avatarUrl },
      create: { googleId, name, email, avatarUrl },
    });

    const token = jwt.sign({ userId: user.id }, env.JWT_SECRET, {
      expiresIn: '7d',
    });

    res.cookie('token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        googleId: user.googleId,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt.toISOString(),
      },
    });
  }
);

export default router;

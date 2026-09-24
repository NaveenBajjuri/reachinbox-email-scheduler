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

/**
 * GET /api/auth/google
 * Initiates the Google OAuth 2.0 authorization redirect.
 */
router.get('/google', (req: Request, res: Response) => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    res.status(503).json({
      success: false,
      error: 'Google OAuth is not configured on this server. Please provide GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file.',
    });
    return;
  }

  const oauth2Client = getOAuth2Client();
  const authorizeUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    prompt: 'consent',
  });

  res.redirect(authorizeUrl);
});

/**
 * GET /api/auth/google/callback
 * Handles the redirect from Google with the authorization code.
 */
router.get('/google/callback', async (req: Request, res: Response) => {
  const { code, error } = req.query;

  if (error) {
    logger.warn('Google OAuth denied or failed:', { error });
    res.redirect(`${env.FRONTEND_URL}/login?error=${encodeURIComponent(String(error))}`);
    return;
  }

  if (!code || typeof code !== 'string') {
    res.status(400).json({ success: false, error: 'Missing authorization code' });
    return;
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    if (!tokens.id_token) {
      throw new Error('No id_token received from Google OAuth exchange');
    }

    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email || !payload.sub) {
      throw new Error('Invalid user payload from Google ID token');
    }

    // Persist or update user in PostgreSQL
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

    // Create session token
    const token = jwt.sign({ userId: user.id }, env.JWT_SECRET, {
      expiresIn: '7d',
    });

    // Set secure cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    logger.info(`User authenticated successfully via Google OAuth: ${user.email} (${user.id})`);
    res.redirect(`${env.FRONTEND_URL}/dashboard`);
  } catch (err: any) {
    logger.error('Google OAuth callback exchange failed:', { error: err.message });
    res.redirect(`${env.FRONTEND_URL}/login?error=oauth_exchange_failed`);
  }
});

/**
 * GET /api/auth/me
 * Returns authenticated user details for header/profile.
 */
router.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    user: req.user,
  });
});

/**
 * POST /api/auth/logout
 * Clears authentication session.
 */
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * Development & Testing Helper: Dev Login
 * Enables automated integration tests and local development testing without
 * needing a manual interactive browser session.
 */
const devLoginSchema = z.object({
  email: z.string().email(),
  name: z.string().optional().default('Dev Tester'),
  avatarUrl: z.string().optional().default('https://api.dicebear.com/7.x/avataaars/svg?seed=ReachInbox'),
});

router.post(
  '/dev-login',
  validateBody(devLoginSchema),
  async (req: Request, res: Response) => {
    if (env.NODE_ENV === 'production') {
      res.status(403).json({ success: false, error: 'Dev login disabled in production' });
      return;
    }

    const { email, name, avatarUrl } = req.body;
    const googleId = `dev-google-id-${email}`;

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

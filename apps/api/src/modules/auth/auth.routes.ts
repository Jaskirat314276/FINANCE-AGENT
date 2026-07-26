import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { googleAuthSchema, loginSchema, signupSchema } from '@seeker/shared';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/error';
import { requireAuth, type AuthedRequest } from '../../middleware/auth';
import * as auth from './auth.service';
import { env } from '../../config/env';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts — try again later' } },
});

const refreshSchema = z.object({ refreshToken: z.string().min(20) });

export const authRouter = Router();

authRouter.post(
  '/signup',
  authLimiter,
  validate(signupSchema),
  asyncHandler(async (req, res) => {
    const result = await auth.signup(req.body);
    res.status(201).json(result);
  }),
);

authRouter.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    res.json(await auth.login(req.body));
  }),
);

authRouter.post(
  '/google',
  authLimiter,
  validate(googleAuthSchema),
  asyncHandler(async (req, res) => {
    res.json(await auth.googleAuth(req.body.credential));
  }),
);

authRouter.post(
  '/refresh',
  validate(refreshSchema),
  asyncHandler(async (req, res) => {
    res.json(await auth.refresh(req.body.refreshToken));
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await auth.logout(req.body?.refreshToken);
    res.json({ ok: true });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: await auth.getMe((req as AuthedRequest).userId) });
  }),
);

/** Public capability flags so the web app can adapt (Google button, demo badge). */
authRouter.get('/capabilities', (_req, res) => {
  res.json({
    googleEnabled: !!env.GOOGLE_CLIENT_ID,
    googleClientId: env.GOOGLE_CLIENT_ID || null,
  });
});

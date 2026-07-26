import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { chatMessageSchema } from '@seeker/shared';
import { requireAuth, type AuthedRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error';
import { validate } from '../../middleware/validate';
import * as chat from './chat.service';

const chatLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Slow down a little — try again shortly' } },
});

const idParamSchema = z.object({ id: z.string().uuid() });

export const chatRouter = Router();
chatRouter.use(requireAuth);

chatRouter.get(
  '/sessions',
  asyncHandler(async (req, res) => {
    res.json({ sessions: await chat.listSessions((req as AuthedRequest).userId) });
  }),
);

chatRouter.get(
  '/sessions/:id',
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    res.json({ messages: await chat.getMessages((req as AuthedRequest).userId, req.params.id!) });
  }),
);

chatRouter.delete(
  '/sessions/:id',
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    await chat.deleteSession((req as AuthedRequest).userId, req.params.id!);
    res.json({ ok: true });
  }),
);

chatRouter.post(
  '/send',
  chatLimiter,
  validate(chatMessageSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof chatMessageSchema>;
    res.json(await chat.send((req as AuthedRequest).userId, body.message, body.sessionId));
  }),
);

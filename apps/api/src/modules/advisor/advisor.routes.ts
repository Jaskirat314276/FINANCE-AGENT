import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { askAdvisorSchema } from '@seeker/shared';
import { requireAuth, type AuthedRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error';
import { validate } from '../../middleware/validate';
import * as advisor from './advisor.service';

const advisorLimiter = rateLimit({
  windowMs: 60_000,
  limit: 12,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Advisor is rate-limited — try again in a minute' } },
});

const symbolParamSchema = z.object({
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z0-9&.\-]{1,20}$/),
});

export const advisorRouter = Router();
advisorRouter.use(requireAuth);

advisorRouter.post(
  '/ask',
  advisorLimiter,
  validate(askAdvisorSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof askAdvisorSchema>;
    res.json(await advisor.ask((req as AuthedRequest).userId, body));
  }),
);

advisorRouter.get(
  '/history',
  asyncHandler(async (req, res) => {
    res.json({ queries: await advisor.history((req as AuthedRequest).userId) });
  }),
);

advisorRouter.get(
  '/stock/:symbol/summary',
  advisorLimiter,
  validate(symbolParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    res.json(await advisor.stockSummary((req as AuthedRequest).userId, req.params.symbol!));
  }),
);

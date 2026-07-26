import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error';
import { getDailyInsight } from './insights.service';

export const insightsRouter = Router();

insightsRouter.get(
  '/daily',
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json(await getDailyInsight());
  }),
);

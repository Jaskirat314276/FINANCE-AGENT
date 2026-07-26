import { Router } from 'express';
import { requireAuth, type AuthedRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error';
import { getStrategies } from './strategies.service';

export const strategiesRouter = Router();

strategiesRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ strategies: await getStrategies((req as AuthedRequest).userId) });
  }),
);

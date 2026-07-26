import { Router } from 'express';
import { onboardingSchema } from '@seeker/shared';
import { requireAuth, type AuthedRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error';
import { validate } from '../../middleware/validate';
import * as profileService from './profile.service';

export const profileRouter = Router();

profileRouter.use(requireAuth);

profileRouter.post(
  '/onboarding',
  validate(onboardingSchema),
  asyncHandler(async (req, res) => {
    const profile = await profileService.saveOnboarding((req as AuthedRequest).userId, req.body);
    res.status(201).json({ profile });
  }),
);

profileRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ profile: await profileService.getProfile((req as AuthedRequest).userId) });
  }),
);

profileRouter.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    res.json(await profileService.getDashboardSummary((req as AuthedRequest).userId));
  }),
);

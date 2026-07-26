import { Router } from 'express';
import { z } from 'zod';
import { generatePortfolioSchema } from '@seeker/shared';
import { requireAuth, type AuthedRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error';
import { validate } from '../../middleware/validate';
import * as portfolioService from './portfolio.service';

const saveSchema = z.object({ portfolio: z.record(z.string(), z.unknown()) });
const simulateSchema = z.object({
  amount: z.number().min(1000).max(1_00_00_00_000),
  years: z.number().min(1).max(40).default(10),
});
const idParamSchema = z.object({ id: z.string().uuid() });

export const portfolioRouter = Router();
portfolioRouter.use(requireAuth);

portfolioRouter.post(
  '/generate',
  validate(generatePortfolioSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof generatePortfolioSchema>;
    const portfolio = await portfolioService.generateForUser((req as AuthedRequest).userId, {
      amount: body.amount,
      monthlySip: body.monthlySip,
      riskOverride: body.riskOverride,
      horizonOverride: body.horizonOverride,
      name: body.name,
    });
    res.json({ portfolio });
  }),
);

portfolioRouter.post(
  '/save',
  validate(saveSchema),
  asyncHandler(async (req, res) => {
    const saved = await portfolioService.savePortfolio(
      (req as AuthedRequest).userId,
      req.body.portfolio,
    );
    res.status(201).json({ portfolio: saved });
  }),
);

portfolioRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ portfolios: await portfolioService.listPortfolios((req as AuthedRequest).userId) });
  }),
);

portfolioRouter.get(
  '/:id',
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    res.json({ portfolio: await portfolioService.getPortfolio((req as AuthedRequest).userId, req.params.id!) });
  }),
);

portfolioRouter.delete(
  '/:id',
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    await portfolioService.deletePortfolio((req as AuthedRequest).userId, req.params.id!);
    res.json({ ok: true });
  }),
);

portfolioRouter.post(
  '/simulate-risk',
  validate(simulateSchema),
  asyncHandler(async (req, res) => {
    const { amount, years } = req.body as z.infer<typeof simulateSchema>;
    res.json(await portfolioService.simulateRisk((req as AuthedRequest).userId, amount, years));
  }),
);

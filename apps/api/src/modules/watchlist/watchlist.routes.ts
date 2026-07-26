import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error';
import { validate } from '../../middleware/validate';
import * as watchlist from './watchlist.service';

const addSchema = z.object({
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z0-9&.\-]{1,20}$/),
  note: z.string().trim().max(200).optional(),
  targetPrice: z.number().positive().optional(),
});

const alertSchema = z.object({
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z0-9&.\-]{1,20}$/),
  kind: z.enum(['PRICE_ABOVE', 'PRICE_BELOW', 'PCT_MOVE', 'RSI_OVERBOUGHT', 'RSI_OVERSOLD', 'NEWS', 'FUNDAMENTAL']),
  threshold: z.number().optional(),
});

const symbolParamSchema = z.object({ symbol: z.string().trim().toUpperCase() });
const idParamSchema = z.object({ id: z.string().uuid() });

export const watchlistRouter = Router();
watchlistRouter.use(requireAuth);

watchlistRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ items: await watchlist.list((req as AuthedRequest).userId) });
  }),
);

watchlistRouter.post(
  '/',
  validate(addSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof addSchema>;
    res.status(201).json({ item: await watchlist.add((req as AuthedRequest).userId, body.symbol, body.note, body.targetPrice) });
  }),
);

watchlistRouter.delete(
  '/:symbol',
  validate(symbolParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    await watchlist.remove((req as AuthedRequest).userId, req.params.symbol!);
    res.json({ ok: true });
  }),
);

watchlistRouter.get(
  '/alerts',
  asyncHandler(async (req, res) => {
    res.json({ alerts: await watchlist.listAlerts((req as AuthedRequest).userId) });
  }),
);

watchlistRouter.post(
  '/alerts',
  validate(alertSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof alertSchema>;
    res.status(201).json({ alert: await watchlist.createAlert((req as AuthedRequest).userId, body) });
  }),
);

watchlistRouter.delete(
  '/alerts/:id',
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    await watchlist.deleteAlert((req as AuthedRequest).userId, req.params.id!);
    res.json({ ok: true });
  }),
);

watchlistRouter.post(
  '/alerts/evaluate',
  asyncHandler(async (req, res) => {
    res.json({ triggered: await watchlist.evaluateAlerts((req as AuthedRequest).userId) });
  }),
);

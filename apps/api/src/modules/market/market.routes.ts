import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/error';
import { validate, getValidatedQuery } from '../../middleware/validate';
import * as market from './market.service';

const searchQuerySchema = z.object({ q: z.string().trim().min(1).max(60) });
const candlesQuerySchema = z.object({
  range: z.enum(['1M', '3M', '6M', '1Y', '3Y', '5Y']).default('1Y'),
});
const symbolParamSchema = z.object({
  symbol: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9&.\-]{1,20}$/, 'Invalid symbol'),
});

export const marketRouter = Router();

marketRouter.get(
  '/snapshot',
  asyncHandler(async (_req, res) => {
    res.json(await market.getMarketSnapshot());
  }),
);

marketRouter.get(
  '/heatmap',
  asyncHandler(async (_req, res) => {
    res.json({ tiles: await market.getHeatmap() });
  }),
);

marketRouter.get('/status', (_req, res) => {
  res.json(market.getProviderStatus());
});

export const stocksRouter = Router();

stocksRouter.get(
  '/search',
  validate(searchQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const { q } = getValidatedQuery<typeof searchQuerySchema>(req);
    res.json({ results: await market.searchStocks(q) });
  }),
);

stocksRouter.get(
  '/trending',
  asyncHandler(async (_req, res) => {
    res.json({ stocks: await market.getTrending() });
  }),
);

stocksRouter.get(
  '/:symbol',
  validate(symbolParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    res.json(await market.getOverview(req.params.symbol!));
  }),
);

stocksRouter.get(
  '/:symbol/candles',
  validate(symbolParamSchema, 'params'),
  validate(candlesQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const { range } = getValidatedQuery<typeof candlesQuerySchema>(req);
    res.json({ candles: await market.getCandles(req.params.symbol!, range) });
  }),
);

stocksRouter.get(
  '/:symbol/news',
  validate(symbolParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    res.json({ news: await market.getNews(req.params.symbol!).catch(() => []) });
  }),
);

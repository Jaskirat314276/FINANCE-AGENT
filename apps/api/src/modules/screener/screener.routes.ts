import { Router } from 'express';
import { z } from 'zod';
import { STOCK_UNIVERSE } from '@seeker/shared';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error';
import { validate, getValidatedQuery } from '../../middleware/validate';
import * as market from '../market/market.service';

/**
 * Rule-based stock screener over the curated universe.
 * Fundamentals come from the provider chain (cached 6h), so screening is
 * cheap after first load and works fully offline in demo mode.
 */

const screenerQuerySchema = z.object({
  sector: z.string().optional(),
  mcap: z.enum(['LARGE', 'MID', 'SMALL']).optional(),
  maxPe: z.coerce.number().positive().optional(),
  minRoe: z.coerce.number().optional(),
  minDivYield: z.coerce.number().optional(),
  maxDebtToEquity: z.coerce.number().optional(),
  minProfitGrowth: z.coerce.number().optional(),
  sort: z.enum(['roe', 'pe', 'divYield', 'profitGrowth', 'marketCap']).default('roe'),
  limit: z.coerce.number().int().min(1).max(40).default(20),
});

export const screenerRouter = Router();

screenerRouter.get(
  '/',
  requireAuth,
  validate(screenerQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const q = getValidatedQuery<typeof screenerQuerySchema>(req);

    // Screener runs on the curated set — it fetches quote+fundamentals per
    // candidate, which must stay bounded (500 stocks ≈ 1,000 provider calls).
    let candidates = STOCK_UNIVERSE.filter((s) => s.curated);
    if (q.sector) candidates = candidates.filter((s) => s.sector === q.sector);
    if (q.mcap) candidates = candidates.filter((s) => s.mcap === q.mcap);

    const rows = await Promise.all(
      candidates.map(async (s) => {
        try {
          const [quote, f] = await Promise.all([market.getQuote(s.symbol), market.getFundamentals(s.symbol)]);
          return { stock: s, quote, f };
        } catch {
          return null;
        }
      }),
    );

    const filtered = rows
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .filter(({ f }) => {
        if (q.maxPe !== undefined && (f.pe === null || f.pe > q.maxPe)) return false;
        if (q.minRoe !== undefined && (f.roe === null || f.roe < q.minRoe)) return false;
        if (q.minDivYield !== undefined && (f.dividendYieldPct === null || f.dividendYieldPct < q.minDivYield)) return false;
        if (q.maxDebtToEquity !== undefined && f.debtToEquity !== null && f.debtToEquity > q.maxDebtToEquity) return false;
        if (q.minProfitGrowth !== undefined && (f.profitGrowthPct === null || f.profitGrowthPct < q.minProfitGrowth)) return false;
        return true;
      });

    const sortKey = {
      roe: (r: (typeof filtered)[number]) => r.f.roe ?? -Infinity,
      pe: (r: (typeof filtered)[number]) => -(r.f.pe ?? Infinity),
      divYield: (r: (typeof filtered)[number]) => r.f.dividendYieldPct ?? -Infinity,
      profitGrowth: (r: (typeof filtered)[number]) => r.f.profitGrowthPct ?? -Infinity,
      marketCap: (r: (typeof filtered)[number]) => r.f.marketCap ?? -Infinity,
    }[q.sort];

    const results = filtered
      .sort((a, b) => sortKey(b) - sortKey(a))
      .slice(0, q.limit)
      .map(({ stock, quote, f }) => ({
        symbol: stock.symbol,
        name: stock.name,
        sector: stock.sector,
        mcap: stock.mcap,
        price: quote.price,
        changePct: quote.changePct,
        pe: f.pe,
        roe: f.roe,
        divYieldPct: f.dividendYieldPct,
        debtToEquity: f.debtToEquity,
        profitGrowthPct: f.profitGrowthPct,
        marketCap: f.marketCap,
      }));

    res.json({ results, universeSize: STOCK_UNIVERSE.length, matched: filtered.length });
  }),
);

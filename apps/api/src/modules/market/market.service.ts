import type {
  Candle,
  CandleRange,
  Fundamentals,
  IndexQuote,
  MarketSnapshot,
  MoverEntry,
  NewsItem,
  Quote,
  SectorPerformance,
  StockOverview,
  UniverseStock,
} from '@seeker/shared';
import { INDEX_DEFS, SNAPSHOT_UNIVERSE, STOCK_UNIVERSE, UNIVERSE_BY_SYMBOL } from '@seeker/shared';
import { env } from '../../config/env';
import { cached } from '../../lib/cache';
import { logger } from '../../lib/logger';
import { computeTechnicals } from './indicators';
import type { MarketDataProvider } from './providers/types';
import { ProviderUnsupported } from './providers/types';
import { MockProvider } from './providers/mock.provider';
import { YahooProvider } from './providers/yahoo.provider';
import { NseProvider } from './providers/nse.provider';
import { AlphaVantageProvider, FinnhubProvider, TwelveDataProvider } from './providers/keyed.providers';

/**
 * Provider chain orchestration. Order comes from MARKET_PROVIDERS;
 * a mock provider is always appended so every capability has a floor.
 * Results are cached with a stale-grace so brief outages degrade to
 * "last known data" (flagged `stale`) instead of errors.
 */

const REGISTRY: Record<string, () => MarketDataProvider> = {
  nse: () => new NseProvider(),
  yahoo: () => new YahooProvider(),
  alphavantage: () => new AlphaVantageProvider(),
  twelvedata: () => new TwelveDataProvider(),
  finnhub: () => new FinnhubProvider(),
  mock: () => new MockProvider(),
};

function buildChain(): MarketDataProvider[] {
  const ids = env.MARKET_PROVIDERS.split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!ids.includes('mock')) ids.push('mock');
  const chain: MarketDataProvider[] = [];
  for (const id of ids) {
    const factory = REGISTRY[id];
    if (!factory) {
      logger.warn(`Unknown market provider "${id}" — skipping`);
      continue;
    }
    const provider = factory();
    if (provider.isConfigured()) chain.push(provider);
  }
  return chain;
}

const chain = buildChain();

async function firstSuccessful<T>(
  capability: string,
  fn: (p: MarketDataProvider) => Promise<T>,
): Promise<T> {
  let lastError: unknown;
  for (const provider of chain) {
    try {
      return await fn(provider);
    } catch (err) {
      if (!(err instanceof ProviderUnsupported)) {
        logger.debug(`provider ${provider.id} failed ${capability}`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
      lastError = err;
    }
  }
  throw lastError ?? new Error(`No provider could serve ${capability}`);
}

const QUOTE_TTL = 60_000;
const CANDLE_TTL = 15 * 60_000;
const FUNDAMENTALS_TTL = 6 * 3600_000;
const NEWS_TTL = 15 * 60_000;
const SNAPSHOT_TTL = 5 * 60_000;

export async function getQuote(symbol: string): Promise<Quote> {
  const { value, stale } = await cached(`quote:${symbol}`, { ttlMs: QUOTE_TTL }, () =>
    firstSuccessful('quote', (p) => p.getQuote(symbol)),
  );
  return stale ? { ...value, stale: true } : value;
}

export async function getCandles(symbol: string, range: CandleRange): Promise<Candle[]> {
  const { value } = await cached(`candles:${symbol}:${range}`, { ttlMs: CANDLE_TTL }, () =>
    firstSuccessful('candles', (p) => p.getCandles(symbol, range)),
  );
  return value;
}

export async function getFundamentals(symbol: string): Promise<Fundamentals> {
  const { value } = await cached(`fund:${symbol}`, { ttlMs: FUNDAMENTALS_TTL }, () =>
    firstSuccessful('fundamentals', (p) => p.getFundamentals(symbol)),
  );
  return value;
}

export async function getNews(symbol: string): Promise<NewsItem[]> {
  const { value } = await cached(`news:${symbol}`, { ttlMs: NEWS_TTL }, () =>
    firstSuccessful('news', (p) => {
      if (!p.getNews) throw new ProviderUnsupported(p.id, 'news');
      return p.getNews(symbol);
    }),
  );
  return value;
}

export async function getIndexQuote(key: IndexQuote['key']): Promise<IndexQuote> {
  const { value } = await cached(`index:${key}`, { ttlMs: QUOTE_TTL * 2 }, () =>
    firstSuccessful('index', (p) => p.getIndexQuote(key)),
  );
  return value;
}

export async function getTechnicals(symbol: string) {
  const candles = await getCandles(symbol, '3Y');
  return computeTechnicals(symbol, candles);
}

/** Bounded-concurrency map over symbols (protects free-tier rate limits). */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<(R | null)[]> {
  const results: (R | null)[] = new Array(items.length).fill(null);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      try {
        results[idx] = await fn(items[idx]!);
      } catch {
        results[idx] = null;
      }
    }
  });
  await Promise.all(workers);
  return results;
}

async function universeQuotes(): Promise<Quote[]> {
  const { value } = await cached('universe:quotes', { ttlMs: SNAPSHOT_TTL }, async () => {
    // Bulk-fetch only the curated snapshot subset — the full 500-stock universe
    // would hammer keyless providers; those stocks are fetched per-symbol on demand.
    const quotes = await mapWithConcurrency(SNAPSHOT_UNIVERSE, 8, (s) => getQuote(s.symbol));
    return quotes.filter((q): q is Quote => q !== null);
  });
  return value;
}

function toMover(q: Quote): MoverEntry {
  const uni: UniverseStock | undefined = UNIVERSE_BY_SYMBOL[q.symbol];
  return {
    symbol: q.symbol,
    name: q.name,
    price: q.price,
    changePct: q.changePct,
    sector: uni?.sector ?? 'CONSUMER',
  };
}

export async function getMarketSnapshot(): Promise<MarketSnapshot> {
  const { value } = await cached('market:snapshot', { ttlMs: SNAPSHOT_TTL }, async () => {
    const [indices, quotes] = await Promise.all([
      Promise.all(
        INDEX_DEFS.map((d) => getIndexQuote(d.key as IndexQuote['key']).catch(() => null)),
      ).then((list) => list.filter((i): i is IndexQuote => i !== null)),
      universeQuotes(),
    ]);

    const sorted = [...quotes].sort((a, b) => b.changePct - a.changePct);
    const topGainers = sorted.slice(0, 5).map(toMover);
    const topLosers = sorted.slice(-5).reverse().map(toMover);

    const bySector = new Map<string, Quote[]>();
    for (const q of quotes) {
      const sector = UNIVERSE_BY_SYMBOL[q.symbol]?.sector;
      if (!sector) continue;
      const list = bySector.get(sector) ?? [];
      list.push(q);
      bySector.set(sector, list);
    }
    const sectorPerformance: SectorPerformance[] = [...bySector.entries()]
      .map(([sector, qs]) => ({
        sector: sector as SectorPerformance['sector'],
        avgChangePct: qs.reduce((a, b) => a + b.changePct, 0) / qs.length,
        advancers: qs.filter((q) => q.changePct > 0).length,
        decliners: qs.filter((q) => q.changePct < 0).length,
      }))
      .sort((a, b) => b.avgChangePct - a.avgChangePct);

    // Sentiment composite: breadth (60%) + index momentum (40%)
    const advancers = quotes.filter((q) => q.changePct > 0).length;
    const breadth = quotes.length ? (advancers / quotes.length) * 2 - 1 : 0;
    const nifty = indices.find((i) => i.key === 'NIFTY50');
    const indexMomentum = Math.max(-1, Math.min(1, (nifty?.changePct ?? 0) / 1.5));
    const score = Math.round((breadth * 0.6 + indexMomentum * 0.4) * 100);
    const label =
      score > 35 ? 'BULLISH' : score > 10 ? 'MILDLY_BULLISH' : score >= -10 ? 'NEUTRAL' : score >= -35 ? 'MILDLY_BEARISH' : 'BEARISH';

    const drivers: string[] = [];
    if (nifty) drivers.push(`NIFTY 50 ${nifty.changePct >= 0 ? 'up' : 'down'} ${Math.abs(nifty.changePct).toFixed(2)}%`);
    drivers.push(`${advancers}/${quotes.length} tracked stocks advancing`);
    const bestSector = sectorPerformance[0];
    const worstSector = sectorPerformance[sectorPerformance.length - 1];
    if (bestSector) drivers.push(`${bestSector.sector} leading (+${bestSector.avgChangePct.toFixed(2)}%)`);
    if (worstSector && worstSector !== bestSector)
      drivers.push(`${worstSector.sector} lagging (${worstSector.avgChangePct.toFixed(2)}%)`);

    const snapshot: MarketSnapshot = {
      indices,
      topGainers,
      topLosers,
      sectorPerformance,
      sentiment: { label, score, drivers },
      asOf: new Date().toISOString(),
      source: quotes[0]?.source ?? 'unknown',
    };
    return snapshot;
  });
  return value;
}

/** Heatmap: every universe stock with quote + sector + mcap tag. */
export async function getHeatmap() {
  const quotes = await universeQuotes();
  return quotes.map((q) => {
    const uni = UNIVERSE_BY_SYMBOL[q.symbol];
    return {
      symbol: q.symbol,
      name: q.name,
      sector: uni?.sector ?? 'CONSUMER',
      mcap: uni?.mcap ?? 'MID',
      price: q.price,
      changePct: q.changePct,
    };
  });
}

export async function getTrending(): Promise<MoverEntry[]> {
  const quotes = await universeQuotes();
  return [...quotes]
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, 8)
    .map(toMover);
}

export async function searchStocks(query: string) {
  const q = query.trim();
  if (!q) return [];
  // Universe match first (instant), then provider search for the long tail.
  const local = STOCK_UNIVERSE.filter(
    (s) => s.symbol.toLowerCase().includes(q.toLowerCase()) || s.name.toLowerCase().includes(q.toLowerCase()),
  ).map((s) => ({ symbol: s.symbol, name: s.name, exchange: 'NSE', inUniverse: true }));
  if (local.length >= 6) return local.slice(0, 8);
  try {
    const remote = await firstSuccessful('search', (p) => {
      if (!p.searchSymbols) throw new ProviderUnsupported(p.id, 'search');
      return p.searchSymbols(q);
    });
    const seen = new Set(local.map((s) => s.symbol));
    return [
      ...local,
      ...remote.filter((r) => !seen.has(r.symbol)).map((r) => ({ ...r, inUniverse: !!UNIVERSE_BY_SYMBOL[r.symbol] })),
    ].slice(0, 8);
  } catch {
    return local;
  }
}

export async function getOverview(symbol: string): Promise<StockOverview> {
  const [quote, fundamentals, technicals, news] = await Promise.all([
    getQuote(symbol),
    getFundamentals(symbol).catch(() => nullFundamentals(symbol)),
    getTechnicals(symbol).catch(() => null),
    getNews(symbol).catch(() => [] as NewsItem[]),
  ]);
  const rating = deriveAnalystView(fundamentals, technicals?.trend ?? 'NEUTRAL');
  return {
    quote,
    fundamentals,
    technicals:
      technicals ??
      computeTechnicals(symbol, []),
    universe: UNIVERSE_BY_SYMBOL[symbol] ?? null,
    news,
    analystRating: rating,
  };
}

function nullFundamentals(symbol: string): Fundamentals {
  return {
    symbol,
    marketCap: null,
    pe: null,
    forwardPe: null,
    eps: null,
    epsGrowthPct: null,
    pb: null,
    roe: null,
    roce: null,
    debtToEquity: null,
    revenue: null,
    revenueGrowthPct: null,
    profitMarginPct: null,
    profitGrowthPct: null,
    dividendYieldPct: null,
    bookValue: null,
    fiftyTwoWeekHigh: null,
    fiftyTwoWeekLow: null,
    beta: null,
    source: 'unavailable',
    asOf: new Date().toISOString(),
  };
}

/**
 * Heuristic "street view" when no paid analyst feed is wired:
 * blends quality (ROE), valuation (PE vs growth) and trend.
 * Clearly labeled as model-derived in the UI.
 */
function deriveAnalystView(f: Fundamentals, trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL') {
  if (f.pe === null && f.roe === null) {
    return { rating: null, targetPrice: null, numAnalysts: null };
  }
  let score = 0;
  if (f.roe !== null) score += f.roe >= 20 ? 2 : f.roe >= 12 ? 1 : f.roe < 6 ? -1 : 0;
  if (f.pe !== null && f.profitGrowthPct !== null && f.profitGrowthPct > 0) {
    const peg = f.pe / f.profitGrowthPct;
    score += peg < 1.2 ? 2 : peg < 2.5 ? 1 : peg > 5 ? -1 : 0;
  } else if (f.pe !== null && f.pe > 80) score -= 1;
  if (f.debtToEquity !== null) score += f.debtToEquity < 0.5 ? 1 : f.debtToEquity > 2 ? -1 : 0;
  score += trend === 'BULLISH' ? 1 : trend === 'BEARISH' ? -1 : 0;
  const rating = score >= 4 ? 'STRONG_BUY' : score >= 2 ? 'BUY' : score >= 0 ? 'HOLD' : score >= -2 ? 'SELL' : 'STRONG_SELL';
  return { rating: rating as NonNullable<StockOverview['analystRating']['rating']>, targetPrice: null, numAnalysts: null };
}

export function getProviderStatus() {
  return {
    chain: chain.map((p) => p.id),
    aiProvider: env.AI_PROVIDER,
  };
}

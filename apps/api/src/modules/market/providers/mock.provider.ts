import type { Candle, CandleRange, Fundamentals, IndexQuote, NewsItem, Quote } from '@seeker/shared';
import { UNIVERSE_BY_SYMBOL, STOCK_UNIVERSE } from '@seeker/shared';
import type { MarketDataProvider } from './types';
import { RANGE_TO_DAYS } from './types';
import { getSampleRow, SAMPLE_INDICES, SAMPLE_NEWS_TEMPLATES } from './sample-data';

const SOURCE = 'mock (demo data)';

/** Deterministic PRNG so demo charts are stable across calls/restarts. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashCode(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Day index since epoch — quote "moves" once per day, deterministically. */
function dayIndex(): number {
  return Math.floor(Date.now() / 86_400_000);
}

function baseFor(symbol: string): { price: number; beta: number } {
  // getSampleRow always returns a row (hand-written or seeded-synthetic), so
  // quotes, candles and fundamentals stay mutually consistent for all ~500 stocks.
  const row = getSampleRow(symbol);
  return { price: row.price, beta: row.beta };
}

/**
 * Generates a stable daily random walk that ENDS at (roughly) the base price,
 * so quotes, candles and fundamentals stay mutually consistent.
 */
function generateCandles(symbol: string, days: number): Candle[] {
  const { price: endPrice, beta } = baseFor(symbol);
  const rng = mulberry32(hashCode(symbol) ^ 0x9e3779b9);
  const dailyVol = 0.011 * beta;
  const rets: number[] = [];
  for (let i = 0; i < days; i++) {
    const u1 = Math.max(rng(), 1e-9);
    const u2 = rng();
    const gauss = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const cycle = Math.sin(i / 34) * 0.0016;
    rets.push(gauss * dailyVol + 0.00035 + cycle);
  }
  // Walk backwards from endPrice so the series lands exactly on base.
  const closes = new Array<number>(days);
  let p = endPrice;
  for (let i = days - 1; i >= 0; i--) {
    closes[i] = p;
    p = p / (1 + rets[i]!);
  }
  const out: Candle[] = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - (days - 1 - i) * (7 / 5)); // approx skip weekends
    const close = closes[i]!;
    const wig = dailyVol * close;
    const rngBar = mulberry32(hashCode(symbol) + i);
    const open = close * (1 + (rngBar() - 0.5) * dailyVol);
    out.push({
      time: d.toISOString().slice(0, 10),
      open,
      high: Math.max(open, close) + rngBar() * wig,
      low: Math.min(open, close) - rngBar() * wig,
      close,
      volume: Math.round(2_00_000 + rngBar() * 60_00_000),
    });
  }
  return out;
}

export class MockProvider implements MarketDataProvider {
  readonly id = 'mock';

  isConfigured(): boolean {
    return true;
  }

  async getQuote(symbol: string): Promise<Quote> {
    const { price, beta } = baseFor(symbol);
    const rng = mulberry32(hashCode(symbol) + dayIndex());
    const changePct = (rng() - 0.48) * 3.2 * beta;
    const priceNow = price * (1 + changePct / 100);
    const prev = price;
    const name = UNIVERSE_BY_SYMBOL[symbol]?.name ?? symbol;
    return {
      symbol,
      name,
      price: round2(priceNow),
      change: round2(priceNow - prev),
      changePct: round2(changePct),
      previousClose: round2(prev),
      dayHigh: round2(priceNow * (1 + rng() * 0.008)),
      dayLow: round2(priceNow * (1 - rng() * 0.008)),
      volume: Math.round(5_00_000 + rng() * 90_00_000),
      currency: 'INR',
      asOf: new Date().toISOString(),
      source: SOURCE,
    };
  }

  async getCandles(symbol: string, range: CandleRange): Promise<Candle[]> {
    return generateCandles(symbol, RANGE_TO_DAYS[range]);
  }

  async getFundamentals(symbol: string): Promise<Fundamentals> {
    const row = getSampleRow(symbol);
    const { price } = baseFor(symbol);
    return {
      symbol,
      marketCap: row?.mcap ?? null,
      pe: row?.pe ?? null,
      forwardPe: row?.pe ? round2(row.pe * 0.9) : null,
      eps: row?.eps ?? null,
      epsGrowthPct: row?.profitGrowth ?? null,
      pb: row?.pb ?? null,
      roe: row?.roe ?? null,
      roce: row?.roce ?? null,
      debtToEquity: row?.de ?? null,
      revenue: row?.revenue ?? null,
      revenueGrowthPct: row?.revGrowth ?? null,
      profitMarginPct: row ? round2(((row.eps ?? 1) * (row.mcap / (row.pe ?? 20) / (row.eps ?? 1))) / row.revenue * 100) : null,
      profitGrowthPct: row?.profitGrowth ?? null,
      dividendYieldPct: row?.divYield ?? null,
      bookValue: row?.pb ? round2(price / row.pb) : null,
      fiftyTwoWeekHigh: round2(price * 1.18),
      fiftyTwoWeekLow: round2(price * 0.74),
      beta: row?.beta ?? 1,
      source: SOURCE,
      asOf: new Date().toISOString(),
    };
  }

  async getIndexQuote(indexKey: IndexQuote['key']): Promise<IndexQuote> {
    const def = SAMPLE_INDICES[indexKey]!;
    const rng = mulberry32(hashCode(indexKey) + dayIndex());
    const changePct = (rng() - 0.47) * 1.6;
    const value = def.base * (1 + changePct / 100);
    return {
      key: indexKey,
      name: def.name,
      value: round2(value),
      change: round2(value - def.base),
      changePct: round2(changePct),
      asOf: new Date().toISOString(),
    };
  }

  async getNews(symbol: string): Promise<NewsItem[]> {
    const name = UNIVERSE_BY_SYMBOL[symbol]?.name ?? symbol;
    const rng = mulberry32(hashCode(symbol) + dayIndex());
    const shuffled = [...SAMPLE_NEWS_TEMPLATES].sort(() => rng() - 0.5).slice(0, 4);
    return shuffled.map((t, i) => ({
      title: t.title.replace('{name}', name),
      url: 'https://example.com/demo-news',
      source: t.source,
      publishedAt: new Date(Date.now() - (i + 1) * 5 * 3600_000).toISOString(),
      summary: 'Demo-mode headline. Connect a live data provider for real news.',
    }));
  }

  async searchSymbols(query: string): Promise<{ symbol: string; name: string; exchange: string }[]> {
    const q = query.trim().toLowerCase();
    return STOCK_UNIVERSE.filter(
      (s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q),
    )
      .slice(0, 8)
      .map((s) => ({ symbol: s.symbol, name: s.name, exchange: 'NSE' }));
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

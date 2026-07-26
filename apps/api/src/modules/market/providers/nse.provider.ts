import type { Candle, CandleRange, Fundamentals, IndexQuote, NewsItem, Quote } from '@seeker/shared';
import { UNIVERSE_BY_SYMBOL } from '@seeker/shared';
import type { MarketDataProvider } from './types';
import { ProviderUnsupported } from './types';

/**
 * NSE India adapter — keyless but cookie-gated. A lightweight session
 * bootstraps Akamai cookies from the homepage and refreshes every 5 minutes.
 * NSE endpoints are best-effort: they intermittently 403 outside India or
 * under load, so this provider is designed to fail fast and let the chain
 * fall through to Yahoo.
 */

const NSE_BASE = 'https://www.nseindia.com';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

class NseSession {
  private cookies = '';
  private fetchedAt = 0;

  private async ensureCookies(): Promise<string> {
    if (this.cookies && Date.now() - this.fetchedAt < 5 * 60_000) return this.cookies;
    const res = await fetch(NSE_BASE, {
      headers: { 'user-agent': UA, accept: 'text/html' },
      signal: AbortSignal.timeout(6000),
    });
    const setCookies = res.headers.getSetCookie?.() ?? [];
    this.cookies = setCookies.map((c) => c.split(';')[0]).join('; ');
    this.fetchedAt = Date.now();
    if (!this.cookies) throw new Error('NSE: could not bootstrap session cookies');
    return this.cookies;
  }

  async getJson<T>(path: string): Promise<T> {
    const cookies = await this.ensureCookies();
    const res = await fetch(`${NSE_BASE}${path}`, {
      headers: {
        'user-agent': UA,
        accept: 'application/json',
        referer: `${NSE_BASE}/`,
        cookie: cookies,
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      this.cookies = ''; // force re-bootstrap next time
      throw new Error(`NSE HTTP ${res.status} for ${path}`);
    }
    return (await res.json()) as T;
  }
}

const session = new NseSession();

const NSE_INDEX_NAMES: Record<IndexQuote['key'], string> = {
  NIFTY50: 'NIFTY 50',
  SENSEX: 'SENSEX', // not on NSE — handled via unsupported
  BANKNIFTY: 'NIFTY BANK',
  NIFTYMIDCAP: 'NIFTY MIDCAP 100',
  NIFTYIT: 'NIFTY IT',
};

export class NseProvider implements MarketDataProvider {
  readonly id = 'nse';

  isConfigured(): boolean {
    return true; // keyless
  }

  async getQuote(symbol: string): Promise<Quote> {
    const data = await session.getJson<{
      info?: { companyName?: string };
      priceInfo?: {
        lastPrice: number;
        change: number;
        pChange: number;
        previousClose: number;
        intraDayHighLow?: { max: number; min: number };
      };
      securityWiseDP?: { quantityTraded?: number };
    }>(`/api/quote-equity?symbol=${encodeURIComponent(symbol)}`);
    const p = data.priceInfo;
    if (!p) throw new Error(`NSE: no priceInfo for ${symbol}`);
    return {
      symbol,
      name: UNIVERSE_BY_SYMBOL[symbol]?.name ?? data.info?.companyName ?? symbol,
      price: p.lastPrice,
      change: p.change,
      changePct: p.pChange,
      previousClose: p.previousClose,
      dayHigh: p.intraDayHighLow?.max ?? p.lastPrice,
      dayLow: p.intraDayHighLow?.min ?? p.lastPrice,
      volume: data.securityWiseDP?.quantityTraded ?? 0,
      currency: 'INR',
      asOf: new Date().toISOString(),
      source: this.id,
    };
  }

  async getCandles(_symbol: string, _range: CandleRange): Promise<Candle[]> {
    // NSE's public chart endpoints are unstable; Yahoo serves candles instead.
    throw new ProviderUnsupported(this.id, 'candles');
  }

  async getFundamentals(_symbol: string): Promise<Fundamentals> {
    throw new ProviderUnsupported(this.id, 'fundamentals');
  }

  async getIndexQuote(indexKey: IndexQuote['key']): Promise<IndexQuote> {
    if (indexKey === 'SENSEX') throw new ProviderUnsupported(this.id, 'BSE indices');
    const data = await session.getJson<{
      data?: Array<{ index: string; last: number; variation: number; percentChange: number }>;
    }>('/api/allIndices');
    const row = data.data?.find((d) => d.index === NSE_INDEX_NAMES[indexKey]);
    if (!row) throw new Error(`NSE: index ${indexKey} not found`);
    return {
      key: indexKey,
      name: NSE_INDEX_NAMES[indexKey],
      value: row.last,
      change: row.variation,
      changePct: row.percentChange,
      asOf: new Date().toISOString(),
    };
  }

  async getNews(_symbol: string): Promise<NewsItem[]> {
    throw new ProviderUnsupported(this.id, 'news');
  }
}

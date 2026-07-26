import type { Candle, CandleRange, Fundamentals, IndexQuote, NewsItem, Quote } from '@seeker/shared';
import { INDEX_DEFS, UNIVERSE_BY_SYMBOL } from '@seeker/shared';
import { getJson } from '../../../lib/http';
import type { MarketDataProvider } from './types';

/**
 * Yahoo Finance adapter — keyless. NSE tickers map to "<SYMBOL>.NS".
 * Quotes/candles use the v8 chart API (works without a crumb); fundamentals
 * use v10 quoteSummary, which now requires a cookie + crumb handshake — the
 * YahooSession below bootstraps and caches those, refreshing on 401.
 */

const CHART_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';
const SUMMARY_BASE = 'https://query2.finance.yahoo.com/v10/finance/quoteSummary';
const SEARCH_BASE = 'https://query1.finance.yahoo.com/v1/finance/search';
const COOKIE_URL = 'https://fc.yahoo.com/';
const CRUMB_URL = 'https://query2.finance.yahoo.com/v1/test/getcrumb';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/**
 * Holds Yahoo's anonymous consent cookie and matching crumb, both required by
 * the quoteSummary (fundamentals) endpoint. Cached for 30 minutes and rebuilt
 * automatically when a request comes back 401 (Invalid Cookie).
 */
class YahooSession {
  private cookie = '';
  private crumb = '';
  private fetchedAt = 0;
  private static readonly TTL = 30 * 60_000;

  private async bootstrap(): Promise<void> {
    const cookieRes = await fetch(COOKIE_URL, {
      headers: { 'user-agent': UA, accept: 'text/html' },
      signal: AbortSignal.timeout(6000),
    });
    const setCookies = cookieRes.headers.getSetCookie?.() ?? [];
    this.cookie = setCookies.map((c) => c.split(';')[0]).join('; ');
    if (!this.cookie) throw new Error('Yahoo: could not obtain session cookie');

    const crumbRes = await fetch(CRUMB_URL, {
      headers: { 'user-agent': UA, accept: 'text/plain', cookie: this.cookie },
      signal: AbortSignal.timeout(6000),
    });
    const crumb = (await crumbRes.text()).trim();
    // A valid crumb is a short opaque token; an error comes back as JSON.
    if (!crumb || crumb.startsWith('{') || crumb.length > 40) {
      throw new Error('Yahoo: could not obtain crumb');
    }
    this.crumb = crumb;
    this.fetchedAt = Date.now();
  }

  private async ensure(): Promise<void> {
    if (this.cookie && this.crumb && Date.now() - this.fetchedAt < YahooSession.TTL) return;
    await this.bootstrap();
  }

  /** Authenticated JSON GET. `buildUrl` receives the URL-encoded crumb. Retries once on 401. */
  async getJson<T>(buildUrl: (encodedCrumb: string) => string): Promise<T> {
    await this.ensure();
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(buildUrl(encodeURIComponent(this.crumb)), {
        headers: { 'user-agent': UA, accept: 'application/json', cookie: this.cookie },
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 401 && attempt === 0) {
        this.cookie = '';
        this.crumb = '';
        await this.bootstrap();
        continue;
      }
      if (!res.ok) throw new Error(`Yahoo HTTP ${res.status} for quoteSummary`);
      return (await res.json()) as T;
    }
    throw new Error('Yahoo: authenticated request failed after cookie refresh');
  }
}

const yahooSession = new YahooSession();

const RANGE_MAP: Record<CandleRange, { range: string; interval: string }> = {
  '1M': { range: '1mo', interval: '1d' },
  '3M': { range: '3mo', interval: '1d' },
  '6M': { range: '6mo', interval: '1d' },
  '1Y': { range: '1y', interval: '1d' },
  '3Y': { range: '3y', interval: '1d' },
  '5Y': { range: '5y', interval: '1wk' },
};

interface ChartResponse {
  chart: {
    result?: Array<{
      meta: {
        symbol: string;
        regularMarketPrice: number;
        chartPreviousClose?: number;
        previousClose?: number;
        regularMarketDayHigh?: number;
        regularMarketDayLow?: number;
        regularMarketVolume?: number;
        longName?: string;
        shortName?: string;
      };
      timestamp?: number[];
      indicators: {
        quote?: Array<{
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }>;
      };
    }>;
    error?: { code: string; description: string } | null;
  };
}

function toYahoo(symbol: string): string {
  const uni = UNIVERSE_BY_SYMBOL[symbol];
  if (uni) return uni.yahooSymbol;
  if (symbol.startsWith('^') || symbol.includes('.')) return symbol;
  return `${symbol}.NS`;
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (v && typeof v === 'object' && 'raw' in v) {
    const raw = (v as { raw?: unknown }).raw;
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  }
  return null;
}

export class YahooProvider implements MarketDataProvider {
  readonly id = 'yahoo';

  isConfigured(): boolean {
    return true; // keyless
  }

  private async chart(symbol: string, range: string, interval: string) {
    const url = `${CHART_BASE}/${encodeURIComponent(toYahoo(symbol))}?range=${range}&interval=${interval}&includePrePost=false`;
    const data = await getJson<ChartResponse>(url);
    const result = data.chart.result?.[0];
    if (!result) throw new Error(data.chart.error?.description ?? `Yahoo: no data for ${symbol}`);
    return result;
  }

  async getQuote(symbol: string): Promise<Quote> {
    const r = await this.chart(symbol, '1d', '1d');
    const meta = r.meta;
    const prev = meta.chartPreviousClose ?? meta.previousClose ?? meta.regularMarketPrice;
    const price = meta.regularMarketPrice;
    return {
      symbol,
      name: UNIVERSE_BY_SYMBOL[symbol]?.name ?? meta.longName ?? meta.shortName ?? symbol,
      price,
      change: price - prev,
      changePct: prev ? ((price - prev) / prev) * 100 : 0,
      previousClose: prev,
      dayHigh: meta.regularMarketDayHigh ?? price,
      dayLow: meta.regularMarketDayLow ?? price,
      volume: meta.regularMarketVolume ?? 0,
      currency: 'INR',
      asOf: new Date().toISOString(),
      source: this.id,
    };
  }

  async getCandles(symbol: string, range: CandleRange): Promise<Candle[]> {
    const { range: r, interval } = RANGE_MAP[range];
    const res = await this.chart(symbol, r, interval);
    const ts = res.timestamp ?? [];
    const q = res.indicators.quote?.[0];
    if (!q) return [];
    const out: Candle[] = [];
    for (let i = 0; i < ts.length; i++) {
      const close = q.close?.[i];
      if (close === null || close === undefined) continue;
      out.push({
        time: new Date(ts[i]! * 1000).toISOString().slice(0, 10),
        open: q.open?.[i] ?? close,
        high: q.high?.[i] ?? close,
        low: q.low?.[i] ?? close,
        close,
        volume: q.volume?.[i] ?? 0,
      });
    }
    return out;
  }

  async getFundamentals(symbol: string): Promise<Fundamentals> {
    const modules = 'summaryDetail,defaultKeyStatistics,financialData';
    const path = `${SUMMARY_BASE}/${encodeURIComponent(toYahoo(symbol))}?modules=${modules}`;
    const data = await yahooSession.getJson<{
      quoteSummary: { result?: Array<Record<string, Record<string, unknown>>>; error?: unknown };
    }>((crumb) => `${path}&crumb=${crumb}`);
    const r = data.quoteSummary.result?.[0];
    if (!r) throw new Error(`Yahoo: quoteSummary unavailable for ${symbol}`);
    const sd = r.summaryDetail ?? {};
    const ks = r.defaultKeyStatistics ?? {};
    const fd = r.financialData ?? {};
    const roe = num(fd.returnOnEquity);
    const margin = num(fd.profitMargins);
    return {
      symbol,
      marketCap: num(sd.marketCap),
      pe: num(sd.trailingPE),
      forwardPe: num(sd.forwardPE) ?? num(ks.forwardPE),
      eps: num(ks.trailingEps),
      epsGrowthPct: pct(num(fd.earningsGrowth)),
      pb: num(ks.priceToBook),
      roe: pct(roe),
      roce: null, // not exposed by Yahoo — chain may fill from another provider
      debtToEquity: scaleDe(num(fd.debtToEquity)),
      revenue: num(fd.totalRevenue),
      revenueGrowthPct: pct(num(fd.revenueGrowth)),
      profitMarginPct: pct(margin),
      profitGrowthPct: pct(num(fd.earningsGrowth)),
      dividendYieldPct: pct(num(sd.dividendYield)),
      bookValue: num(ks.bookValue),
      fiftyTwoWeekHigh: num(sd.fiftyTwoWeekHigh),
      fiftyTwoWeekLow: num(sd.fiftyTwoWeekLow),
      beta: num(sd.beta) ?? num(ks.beta),
      source: this.id,
      asOf: new Date().toISOString(),
    };
  }

  async getIndexQuote(indexKey: IndexQuote['key']): Promise<IndexQuote> {
    const def = INDEX_DEFS.find((d) => d.key === indexKey);
    if (!def) throw new Error(`Unknown index ${indexKey}`);
    const q = await this.getQuote(def.yahooSymbol);
    return {
      key: indexKey,
      name: def.name,
      value: q.price,
      change: q.change,
      changePct: q.changePct,
      asOf: q.asOf,
    };
  }

  async getNews(symbol: string): Promise<NewsItem[]> {
    const uni = UNIVERSE_BY_SYMBOL[symbol];
    const q = uni ? uni.name : symbol;
    const url = `${SEARCH_BASE}?q=${encodeURIComponent(q)}&quotesCount=0&newsCount=8`;
    const data = await getJson<{
      news?: Array<{ title: string; link: string; publisher: string; providerPublishTime: number }>;
    }>(url);
    return (data.news ?? []).map((n) => ({
      title: n.title,
      url: n.link,
      source: n.publisher,
      publishedAt: new Date(n.providerPublishTime * 1000).toISOString(),
    }));
  }

  async searchSymbols(query: string): Promise<{ symbol: string; name: string; exchange: string }[]> {
    const url = `${SEARCH_BASE}?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`;
    const data = await getJson<{
      quotes?: Array<{ symbol: string; shortname?: string; longname?: string; exchange?: string }>;
    }>(url);
    return (data.quotes ?? [])
      .filter((q) => q.symbol.endsWith('.NS') || q.symbol.endsWith('.BO'))
      .map((q) => ({
        symbol: q.symbol.replace(/\.(NS|BO)$/, ''),
        name: q.longname ?? q.shortname ?? q.symbol,
        exchange: q.symbol.endsWith('.NS') ? 'NSE' : 'BSE',
      }));
  }
}

function pct(v: number | null): number | null {
  if (v === null) return null;
  // Yahoo returns fractions (0.12) for growth/yield-type fields
  return Math.abs(v) <= 1.5 ? v * 100 : v;
}

/** Yahoo reports D/E as percentage (e.g. 41.2 ⇒ 0.41x). */
function scaleDe(v: number | null): number | null {
  if (v === null) return null;
  return v > 5 ? v / 100 : v;
}

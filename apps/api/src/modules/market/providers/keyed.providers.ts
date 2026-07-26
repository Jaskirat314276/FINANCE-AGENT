import type { Candle, CandleRange, Fundamentals, IndexQuote, Quote } from '@seeker/shared';
import { UNIVERSE_BY_SYMBOL } from '@seeker/shared';
import { env } from '../../../config/env';
import { getJson } from '../../../lib/http';
import type { MarketDataProvider } from './types';
import { ProviderUnsupported, RANGE_TO_DAYS } from './types';

/**
 * Keyed adapters: Alpha Vantage, TwelveData, Finnhub.
 * Each activates only when its API key is present. They mainly add
 * redundancy for quotes/candles; Indian fundamentals coverage on free
 * tiers is thin, so fundamentals typically resolve via Yahoo or mock.
 */

export class AlphaVantageProvider implements MarketDataProvider {
  readonly id = 'alphavantage';

  isConfigured(): boolean {
    return !!env.ALPHAVANTAGE_API_KEY;
  }

  async getQuote(symbol: string): Promise<Quote> {
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(`${symbol}.BSE`)}&apikey=${env.ALPHAVANTAGE_API_KEY}`;
    const data = await getJson<{ 'Global Quote'?: Record<string, string> }>(url);
    const q = data['Global Quote'];
    if (!q || !q['05. price']) throw new Error(`AlphaVantage: no quote for ${symbol}`);
    const price = parseFloat(q['05. price']!);
    const prev = parseFloat(q['08. previous close'] ?? String(price));
    return {
      symbol,
      name: UNIVERSE_BY_SYMBOL[symbol]?.name ?? symbol,
      price,
      change: parseFloat(q['09. change'] ?? '0'),
      changePct: parseFloat((q['10. change percent'] ?? '0').replace('%', '')),
      previousClose: prev,
      dayHigh: parseFloat(q['03. high'] ?? String(price)),
      dayLow: parseFloat(q['04. low'] ?? String(price)),
      volume: parseInt(q['06. volume'] ?? '0', 10),
      currency: 'INR',
      asOf: new Date().toISOString(),
      source: this.id,
    };
  }

  async getCandles(symbol: string, range: CandleRange): Promise<Candle[]> {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(`${symbol}.BSE`)}&outputsize=full&apikey=${env.ALPHAVANTAGE_API_KEY}`;
    const data = await getJson<{ 'Time Series (Daily)'?: Record<string, Record<string, string>> }>(url);
    const series = data['Time Series (Daily)'];
    if (!series) throw new Error(`AlphaVantage: no candles for ${symbol}`);
    return Object.entries(series)
      .map(([date, v]) => ({
        time: date,
        open: parseFloat(v['1. open'] ?? '0'),
        high: parseFloat(v['2. high'] ?? '0'),
        low: parseFloat(v['3. low'] ?? '0'),
        close: parseFloat(v['4. close'] ?? '0'),
        volume: parseInt(v['5. volume'] ?? '0', 10),
      }))
      .sort((a, b) => a.time.localeCompare(b.time))
      .slice(-RANGE_TO_DAYS[range]);
  }

  async getFundamentals(_symbol: string): Promise<Fundamentals> {
    throw new ProviderUnsupported(this.id, 'Indian fundamentals');
  }

  async getIndexQuote(_indexKey: IndexQuote['key']): Promise<IndexQuote> {
    throw new ProviderUnsupported(this.id, 'Indian indices');
  }
}

export class TwelveDataProvider implements MarketDataProvider {
  readonly id = 'twelvedata';

  isConfigured(): boolean {
    return !!env.TWELVEDATA_API_KEY;
  }

  async getQuote(symbol: string): Promise<Quote> {
    const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&exchange=NSE&apikey=${env.TWELVEDATA_API_KEY}`;
    const q = await getJson<Record<string, string> & { code?: number }>(url);
    if (q.code || !q.close) throw new Error(`TwelveData: no quote for ${symbol}`);
    const price = parseFloat(q.close!);
    const prev = parseFloat(q.previous_close ?? String(price));
    return {
      symbol,
      name: UNIVERSE_BY_SYMBOL[symbol]?.name ?? q.name ?? symbol,
      price,
      change: parseFloat(q.change ?? '0'),
      changePct: parseFloat(q.percent_change ?? '0'),
      previousClose: prev,
      dayHigh: parseFloat(q.high ?? String(price)),
      dayLow: parseFloat(q.low ?? String(price)),
      volume: parseInt(q.volume ?? '0', 10),
      currency: 'INR',
      asOf: new Date().toISOString(),
      source: this.id,
    };
  }

  async getCandles(symbol: string, range: CandleRange): Promise<Candle[]> {
    const size = Math.min(RANGE_TO_DAYS[range], 5000);
    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&exchange=NSE&interval=1day&outputsize=${size}&apikey=${env.TWELVEDATA_API_KEY}`;
    const data = await getJson<{
      values?: Array<{ datetime: string; open: string; high: string; low: string; close: string; volume: string }>;
      code?: number;
    }>(url);
    if (!data.values) throw new Error(`TwelveData: no candles for ${symbol}`);
    return data.values
      .map((v) => ({
        time: v.datetime,
        open: parseFloat(v.open),
        high: parseFloat(v.high),
        low: parseFloat(v.low),
        close: parseFloat(v.close),
        volume: parseInt(v.volume ?? '0', 10),
      }))
      .sort((a, b) => a.time.localeCompare(b.time));
  }

  async getFundamentals(_symbol: string): Promise<Fundamentals> {
    throw new ProviderUnsupported(this.id, 'fundamentals (paid tier)');
  }

  async getIndexQuote(_indexKey: IndexQuote['key']): Promise<IndexQuote> {
    throw new ProviderUnsupported(this.id, 'Indian indices (free tier)');
  }
}

export class FinnhubProvider implements MarketDataProvider {
  readonly id = 'finnhub';

  isConfigured(): boolean {
    return !!env.FINNHUB_API_KEY;
  }

  async getQuote(symbol: string): Promise<Quote> {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(`${symbol}.NS`)}&token=${env.FINNHUB_API_KEY}`;
    const q = await getJson<{ c: number; d: number; dp: number; h: number; l: number; pc: number }>(url);
    if (!q.c) throw new Error(`Finnhub: no quote for ${symbol}`);
    return {
      symbol,
      name: UNIVERSE_BY_SYMBOL[symbol]?.name ?? symbol,
      price: q.c,
      change: q.d,
      changePct: q.dp,
      previousClose: q.pc,
      dayHigh: q.h,
      dayLow: q.l,
      volume: 0,
      currency: 'INR',
      asOf: new Date().toISOString(),
      source: this.id,
    };
  }

  async getCandles(_symbol: string, _range: CandleRange): Promise<Candle[]> {
    throw new ProviderUnsupported(this.id, 'candles (paid tier for NSE)');
  }

  async getFundamentals(_symbol: string): Promise<Fundamentals> {
    throw new ProviderUnsupported(this.id, 'Indian fundamentals');
  }

  async getIndexQuote(_indexKey: IndexQuote['key']): Promise<IndexQuote> {
    throw new ProviderUnsupported(this.id, 'Indian indices');
  }
}

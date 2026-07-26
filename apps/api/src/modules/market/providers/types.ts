import type { Candle, CandleRange, Fundamentals, IndexQuote, NewsItem, Quote } from '@seeker/shared';

/**
 * Provider abstraction. Canonical symbols are NSE tickers ("TCS");
 * each adapter translates internally (e.g. Yahoo → "TCS.NS").
 * Adapters throw `ProviderUnsupported` for capabilities they lack —
 * the chain simply moves to the next provider.
 */
export interface MarketDataProvider {
  readonly id: string;
  /** False when a required API key / config is missing. */
  isConfigured(): boolean;
  getQuote(symbol: string): Promise<Quote>;
  getCandles(symbol: string, range: CandleRange): Promise<Candle[]>;
  getFundamentals(symbol: string): Promise<Fundamentals>;
  getIndexQuote(indexKey: IndexQuote['key']): Promise<IndexQuote>;
  getNews?(symbol: string): Promise<NewsItem[]>;
  searchSymbols?(query: string): Promise<{ symbol: string; name: string; exchange: string }[]>;
}

export class ProviderUnsupported extends Error {
  constructor(providerId: string, capability: string) {
    super(`${providerId} does not support ${capability}`);
    this.name = 'ProviderUnsupported';
  }
}

export const RANGE_TO_DAYS: Record<CandleRange, number> = {
  '1M': 22,
  '3M': 66,
  '6M': 130,
  '1Y': 250,
  '3Y': 750,
  '5Y': 1250,
};

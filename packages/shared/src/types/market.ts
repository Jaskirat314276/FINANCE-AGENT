/** Market data domain types — provider-agnostic. */

export type McapCategory = 'LARGE' | 'MID' | 'SMALL';

import type { Sector } from './profile';

/** A stock in the curated NSE universe. */
export interface UniverseStock {
  symbol: string; // NSE symbol, e.g. "TCS"
  name: string;
  sector: Sector;
  mcap: McapCategory;
  /** True for the most established, liquid names. */
  blueChip: boolean;
  /** Pays a meaningful, consistent dividend. */
  dividendPayer: boolean;
  esgFriendly: boolean;
  yahooSymbol: string; // e.g. "TCS.NS"
}

export interface Quote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  previousClose: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  currency: 'INR';
  asOf: string; // ISO timestamp
  source: string; // provider id that served this
  stale?: boolean;
}

export interface Candle {
  time: string; // ISO date
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type CandleRange = '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y';

export interface Fundamentals {
  symbol: string;
  marketCap: number | null; // ₹
  pe: number | null;
  forwardPe: number | null;
  eps: number | null;
  epsGrowthPct: number | null;
  pb: number | null;
  roe: number | null; // %
  roce: number | null; // %
  debtToEquity: number | null;
  revenue: number | null; // ₹ TTM
  revenueGrowthPct: number | null;
  profitMarginPct: number | null;
  profitGrowthPct: number | null;
  dividendYieldPct: number | null;
  bookValue: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  beta: number | null;
  source: string;
  asOf: string;
}

export interface TechnicalSnapshot {
  symbol: string;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  ema12: number | null;
  ema26: number | null;
  rsi14: number | null;
  macd: { line: number; signal: number; histogram: number } | null;
  bollinger: { upper: number; middle: number; lower: number } | null;
  support: number | null;
  resistance: number | null;
  /** Simple composite read of the indicators. */
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  signals: string[]; // human-readable, e.g. "Price above 200-DMA (long-term uptrend)"
  asOf: string;
}

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  summary?: string;
}

export interface StockOverview {
  quote: Quote;
  fundamentals: Fundamentals;
  technicals: TechnicalSnapshot;
  universe: UniverseStock | null;
  news: NewsItem[];
  analystRating: {
    rating: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL' | null;
    targetPrice: number | null;
    numAnalysts: number | null;
  };
}

export interface IndexQuote {
  key: 'NIFTY50' | 'SENSEX' | 'BANKNIFTY' | 'NIFTYMIDCAP' | 'NIFTYIT';
  name: string;
  value: number;
  change: number;
  changePct: number;
  asOf: string;
}

export interface MoverEntry {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  sector: Sector;
}

export interface SectorPerformance {
  sector: Sector;
  avgChangePct: number;
  advancers: number;
  decliners: number;
}

export interface MarketSnapshot {
  indices: IndexQuote[];
  topGainers: MoverEntry[];
  topLosers: MoverEntry[];
  sectorPerformance: SectorPerformance[];
  sentiment: {
    label: 'BULLISH' | 'MILDLY_BULLISH' | 'NEUTRAL' | 'MILDLY_BEARISH' | 'BEARISH';
    score: number; // -100..100
    drivers: string[];
  };
  asOf: string;
  source: string;
}

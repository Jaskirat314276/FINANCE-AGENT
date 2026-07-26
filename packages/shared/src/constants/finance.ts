import type { AssetClass } from '../types/portfolio';
import type { Horizon, RiskBand } from '../types/profile';

/**
 * Long-run capital-market assumptions for Indian assets (nominal, % p.a.).
 * These are planning estimates, not predictions — surfaced to users as such.
 */
export const ASSET_ASSUMPTIONS: Record<AssetClass, { cagr: number; vol: number; label: string }> = {
  STOCKS_LARGE: { cagr: 12.0, vol: 17, label: 'Large-cap stocks' },
  STOCKS_MID: { cagr: 14.0, vol: 22, label: 'Mid-cap stocks' },
  STOCKS_SMALL: { cagr: 16.0, vol: 28, label: 'Small-cap stocks' },
  EQUITY_MF: { cagr: 12.5, vol: 16, label: 'Equity mutual funds' },
  DEBT_MF: { cagr: 7.0, vol: 3, label: 'Debt funds' },
  INDEX_ETF: { cagr: 11.5, vol: 15, label: 'Index ETFs' },
  GOLD: { cagr: 8.5, vol: 14, label: 'Gold' },
  CASH: { cagr: 4.0, vol: 0.5, label: 'Cash / liquid' },
};

/** Default correlation used for portfolio vol aggregation (simplified single-factor). */
export const DEFAULT_EQUITY_CORRELATION = 0.85;
export const DEFAULT_CROSS_ASSET_CORRELATION = 0.25;

export const DEFAULT_INFLATION_PCT = 5.5;
export const RISK_FREE_PCT = 7.0; // proxy: 10Y G-Sec / FD band

export const HORIZON_YEARS: Record<Horizon, number> = {
  LT_1Y: 0.75,
  Y1_3: 2,
  Y3_5: 4,
  Y5_10: 7,
  GT_10Y: 12,
};

export const HORIZON_LABELS: Record<Horizon, string> = {
  LT_1Y: 'Less than 1 year',
  Y1_3: '1–3 years',
  Y3_5: '3–5 years',
  Y5_10: '5–10 years',
  GT_10Y: '10+ years',
};

/**
 * Base strategic allocation matrix by risk band (percent).
 * The engine then tilts by horizon, emergency-fund status and preferences.
 */
export const BASE_ALLOCATION: Record<RiskBand, Partial<Record<AssetClass, number>>> = {
  LOW: { STOCKS_LARGE: 10, INDEX_ETF: 15, EQUITY_MF: 10, DEBT_MF: 40, GOLD: 10, CASH: 15 },
  MEDIUM: { STOCKS_LARGE: 20, STOCKS_MID: 5, INDEX_ETF: 20, EQUITY_MF: 15, DEBT_MF: 25, GOLD: 10, CASH: 5 },
  AGGRESSIVE: { STOCKS_LARGE: 28, STOCKS_MID: 14, STOCKS_SMALL: 6, INDEX_ETF: 17, EQUITY_MF: 15, DEBT_MF: 10, GOLD: 7, CASH: 3 },
  VERY_AGGRESSIVE: { STOCKS_LARGE: 30, STOCKS_MID: 20, STOCKS_SMALL: 12, INDEX_ETF: 15, EQUITY_MF: 13, DEBT_MF: 4, GOLD: 4, CASH: 2 },
};

export const EMERGENCY_FUND_TARGET_MONTHS = 6;

export const SEBI_DISCLAIMER =
  'Seeker AI is an educational tool, not a SEBI-registered investment adviser. ' +
  'Markets carry risk; past performance does not guarantee future returns. ' +
  'Consider consulting a registered adviser before acting.';

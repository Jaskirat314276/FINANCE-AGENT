/** Portfolio engine + strategy types. */

import type { RiskBand, Horizon, Sector } from './profile';
import type { McapCategory } from './market';

export const ASSET_CLASSES = [
  'STOCKS_LARGE',
  'STOCKS_MID',
  'STOCKS_SMALL',
  'EQUITY_MF',
  'DEBT_MF',
  'INDEX_ETF',
  'GOLD',
  'CASH',
] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

export interface AllocationSlice {
  assetClass: AssetClass;
  label: string;
  pct: number; // 0–100
  amount: number; // ₹
  rationale: string;
}

export interface StockPick {
  symbol: string;
  name: string;
  sector: Sector;
  mcap: McapCategory;
  weightPct: number; // of the equity sleeve
  amount: number; // ₹
  approxShares: number;
  price: number;
  rationale: string;
}

export interface FundPick {
  name: string;
  category: string;
  pct: number;
  amount: number;
  rationale: string;
}

export interface MonteCarloResult {
  years: number;
  simulations: number;
  expectedCagrPct: number;
  volatilityPct: number;
  /** Percentile paths: yearly portfolio values in ₹. */
  percentiles: {
    p10: number[];
    p25: number[];
    p50: number[];
    p75: number[];
    p90: number[];
  };
  probLoss: number; // probability of ending below invested capital
  probTarget?: number; // probability of reaching target, if any
  invested: number[]; // cumulative invested per year (lump + SIP)
}

export interface RebalanceRule {
  frequency: 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL';
  driftThresholdPct: number;
  notes: string[];
}

export interface GeneratedPortfolio {
  id?: string;
  name: string;
  amount: number;
  monthlySip: number;
  riskBand: RiskBand;
  riskScore: number;
  horizon: Horizon;
  allocation: AllocationSlice[];
  stocks: StockPick[];
  funds: FundPick[];
  expectedCagrPct: number;
  volatilityPct: number;
  monteCarlo: MonteCarloResult;
  rebalancing: RebalanceRule;
  warnings: string[];
  createdAt?: string;
}

export const STRATEGY_KEYS = [
  'CONSERVATIVE',
  'BALANCED',
  'GROWTH',
  'AGGRESSIVE',
  'HIGH_DIVIDEND',
  'VALUE',
  'MOMENTUM',
  'SWING',
  'LONG_TERM',
  'RETIREMENT',
  'GOAL_BASED',
] as const;
export type StrategyKey = (typeof STRATEGY_KEYS)[number];

export interface StrategyBlueprint {
  key: StrategyKey;
  name: string;
  tagline: string;
  allocation: { label: string; pct: number }[];
  expectedCagrPct: { min: number; max: number };
  risk: 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH';
  volatilityPct: number;
  suitableFor: string[];
  horizon: string;
  notes: string[];
  /** Personalised fit score 0–100 for the current user (server-computed). */
  fitScore?: number;
  fitReason?: string;
}

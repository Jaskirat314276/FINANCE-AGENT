/**
 * User financial-profile domain types.
 * Single source of truth shared by API (Prisma mapping + services)
 * and web (forms, dashboard rendering).
 */

export const EMPLOYMENT_TYPES = [
  'STUDENT',
  'SELF_EMPLOYED',
  'BUSINESS',
  'GOVERNMENT',
  'PRIVATE',
  'RETIRED',
] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const GENDERS = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'] as const;
export type Gender = (typeof GENDERS)[number];

export const INCOME_STABILITY = ['VERY_STABLE', 'STABLE', 'VARIABLE', 'UNSTABLE'] as const;
export type IncomeStability = (typeof INCOME_STABILITY)[number];

export const RISK_BANDS = ['LOW', 'MEDIUM', 'AGGRESSIVE', 'VERY_AGGRESSIVE'] as const;
export type RiskBand = (typeof RISK_BANDS)[number];

export const HORIZONS = ['LT_1Y', 'Y1_3', 'Y3_5', 'Y5_10', 'GT_10Y'] as const;
export type Horizon = (typeof HORIZONS)[number];

export const GOAL_TYPES = [
  'RETIREMENT',
  'HOUSE',
  'CAR',
  'MARRIAGE',
  'CHILD_EDUCATION',
  'VACATION',
  'WEALTH_CREATION',
  'PASSIVE_INCOME',
  'FINANCIAL_FREEDOM',
  'CUSTOM',
] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

export const TAX_SLABS = ['NONE', 'S5', 'S10', 'S15', 'S20', 'S30'] as const;
export type TaxSlab = (typeof TAX_SLABS)[number];

export const CAPITAL_GAIN_PREFS = ['LONG_TERM', 'SHORT_TERM', 'BALANCED'] as const;
export type CapitalGainPref = (typeof CAPITAL_GAIN_PREFS)[number];

export const INVESTING_STYLES = [
  'ESG',
  'DIVIDEND',
  'GROWTH',
  'VALUE',
  'MOMENTUM',
] as const;
export type InvestingStyle = (typeof INVESTING_STYLES)[number];

export const MARKET_CAP_PREFS = ['SMALL_CAP', 'MID_CAP', 'LARGE_CAP', 'BLUE_CHIP'] as const;
export type MarketCapPref = (typeof MARKET_CAP_PREFS)[number];

export const SECTORS = [
  'TECHNOLOGY',
  'BANKING',
  'FINANCIAL_SERVICES',
  'HEALTHCARE',
  'PHARMA',
  'AUTO',
  'ENERGY',
  'FMCG',
  'MANUFACTURING',
  'INFRASTRUCTURE',
  'METALS',
  'TELECOM',
  'CONSUMER',
  'DEFENCE',
] as const;
export type Sector = (typeof SECTORS)[number];

/** Existing investment holdings captured at onboarding (₹ amounts). */
export interface ExistingInvestments {
  fd: number;
  mutualFunds: number;
  stocks: number;
  gold: number;
  crypto: number;
  realEstate: number;
  ppf: number;
  epf: number;
}

export interface InvestmentGoalInput {
  type: GoalType;
  /** Free-text label, required when type === 'CUSTOM'. */
  label?: string;
  targetAmount: number;
  targetYears: number;
  priority: 1 | 2 | 3;
}

/** Fully assembled onboarding payload (steps 1–9). */
export interface FinancialProfileInput {
  // Step 1 — personal
  age: number;
  gender: Gender;
  occupation: string;
  city: string;
  employmentType: EmploymentType;
  dependents: number;
  // Step 2 — income
  monthlyIncome: number;
  annualIncome: number;
  incomeStability: IncomeStability;
  expectedSalaryGrowthPct: number;
  // Step 3 — financial situation
  currentSavings: number;
  emergencyFund: number;
  monthlyExpenses: number;
  monthlyEmi: number;
  existingInvestments: ExistingInvestments;
  // Step 4 — goals
  goals: InvestmentGoalInput[];
  // Step 5 — risk (raw answers; the server derives score + band)
  riskAnswers: Record<string, number>;
  // Step 6 — horizon
  horizon: Horizon;
  // Step 7 — amounts
  monthlySip: number;
  lumpSum: number;
  annualInvestment: number;
  maxSingleStockAllocationPct: number;
  // Step 8 — preferences
  styles: InvestingStyle[];
  marketCapPrefs: MarketCapPref[];
  preferredSectors: Sector[];
  avoidSectors: Sector[];
  // Step 9 — tax
  taxSlab: TaxSlab;
  used80cAmount: number;
  capitalGainPref: CapitalGainPref;
}

/** Profile as stored + derived server-side scores. */
export interface FinancialProfile extends FinancialProfileInput {
  id: string;
  userId: string;
  riskScore: number; // 0–100
  riskBand: RiskBand;
  financialHealthScore: number; // 0–100
  investmentReadinessScore: number; // 0–100
  /** True when the user skipped onboarding and runs on the neutral default profile. */
  onboardingSkipped?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScoreBreakdownItem {
  key: string;
  label: string;
  score: number;
  max: number;
  comment: string;
}

export interface HealthScoreReport {
  score: number;
  grade: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'NEEDS_ATTENTION';
  breakdown: ScoreBreakdownItem[];
  suggestions: string[];
}

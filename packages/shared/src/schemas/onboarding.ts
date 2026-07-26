import { z } from 'zod';
import {
  EMPLOYMENT_TYPES,
  GENDERS,
  GOAL_TYPES,
  HORIZONS,
  INCOME_STABILITY,
  INVESTING_STYLES,
  MARKET_CAP_PREFS,
  SECTORS,
  TAX_SLABS,
  CAPITAL_GAIN_PREFS,
} from '../types/profile';

const money = z.number().min(0, 'Cannot be negative').max(1_000_00_00_000, 'Value looks too large');

/** Step 1 — personal details */
export const personalStepSchema = z.object({
  age: z.number().int().min(16, 'Must be at least 16').max(100),
  gender: z.enum(GENDERS),
  occupation: z.string().trim().min(2, 'Tell us your occupation').max(80),
  city: z.string().trim().min(2, 'Enter your city').max(80),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  dependents: z.number().int().min(0).max(12),
});

/** Step 2 — income */
export const incomeStepSchema = z
  .object({
    monthlyIncome: money,
    annualIncome: money,
    incomeStability: z.enum(INCOME_STABILITY),
    expectedSalaryGrowthPct: z.number().min(0).max(100),
  })
  .refine((v) => v.annualIncome === 0 || v.annualIncome >= v.monthlyIncome, {
    message: 'Annual income cannot be lower than monthly income',
    path: ['annualIncome'],
  });

/** Step 3 — financial situation */
export const financialStepSchema = z.object({
  currentSavings: money,
  emergencyFund: money,
  monthlyExpenses: money,
  monthlyEmi: money,
  existingInvestments: z.object({
    fd: money,
    mutualFunds: money,
    stocks: money,
    gold: money,
    crypto: money,
    realEstate: money,
    ppf: money,
    epf: money,
  }),
});

/** Step 4 — goals */
export const goalSchema = z
  .object({
    type: z.enum(GOAL_TYPES),
    label: z.string().trim().max(60).optional(),
    targetAmount: money.refine((v) => v > 0, 'Set a target amount'),
    targetYears: z.number().min(0.5).max(50),
    priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  })
  .refine((g) => g.type !== 'CUSTOM' || (g.label && g.label.length >= 2), {
    message: 'Name your custom goal',
    path: ['label'],
  });

export const goalsStepSchema = z.object({
  goals: z.array(goalSchema).min(1, 'Pick at least one goal').max(8),
});

/** Step 5 — risk quiz answers: questionId -> chosen score */
export const riskStepSchema = z.object({
  riskAnswers: z.record(z.string(), z.number().int().min(0).max(4)),
});

/** Step 6 — horizon */
export const horizonStepSchema = z.object({ horizon: z.enum(HORIZONS) });

/** Step 7 — amounts */
export const amountStepSchema = z.object({
  monthlySip: money,
  lumpSum: money,
  annualInvestment: money,
  maxSingleStockAllocationPct: z.number().min(5).max(100).default(25),
});

/** Step 8 — preferences */
export const preferencesStepSchema = z.object({
  styles: z.array(z.enum(INVESTING_STYLES)).max(5),
  marketCapPrefs: z.array(z.enum(MARKET_CAP_PREFS)).max(4),
  preferredSectors: z.array(z.enum(SECTORS)).max(14),
  avoidSectors: z.array(z.enum(SECTORS)).max(14),
});

/** Step 9 — tax */
export const taxStepSchema = z.object({
  taxSlab: z.enum(TAX_SLABS),
  used80cAmount: z.number().min(0).max(150_000),
  capitalGainPref: z.enum(CAPITAL_GAIN_PREFS),
});

/** Full onboarding payload sent once at the end. */
export const onboardingSchema = personalStepSchema
  .merge(financialStepSchema)
  .merge(goalsStepSchema)
  .merge(riskStepSchema)
  .merge(horizonStepSchema)
  .merge(amountStepSchema)
  .merge(preferencesStepSchema)
  .merge(taxStepSchema)
  .extend({
    monthlyIncome: money,
    annualIncome: money,
    incomeStability: z.enum(INCOME_STABILITY),
    expectedSalaryGrowthPct: z.number().min(0).max(100),
  });

export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const ONBOARDING_STEP_SCHEMAS = {
  1: personalStepSchema,
  2: incomeStepSchema,
  3: financialStepSchema,
  4: goalsStepSchema,
  5: riskStepSchema,
  6: horizonStepSchema,
  7: amountStepSchema,
  8: preferencesStepSchema,
  9: taxStepSchema,
} as const;

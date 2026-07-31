import type { FinancialProfile as ProfileRow, Goal as GoalRow, Prisma } from '@prisma/client';
import type { FinancialProfile, HealthScoreReport, OnboardingInput } from '@seeker/shared';
import { DEFAULT_INFLATION_PCT, inflate, lumpSumFutureValue, RISK_QUESTIONS, sipRequiredForTarget } from '@seeker/shared';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../middleware/error';
import { computeFinancialHealth, computeInvestmentReadiness, computeRiskScore } from './scoring';

/** Map Prisma rows → shared FinancialProfile DTO (used across engines/AI). */
export function toProfileDto(row: ProfileRow & { goals: GoalRow[] }): FinancialProfile {
  return {
    id: row.id,
    userId: row.userId,
    age: row.age,
    gender: row.gender,
    occupation: row.occupation,
    city: row.city,
    employmentType: row.employmentType,
    dependents: row.dependents,
    monthlyIncome: row.monthlyIncome,
    annualIncome: row.annualIncome,
    incomeStability: row.incomeStability,
    expectedSalaryGrowthPct: row.expectedSalaryGrowthPct,
    currentSavings: row.currentSavings,
    emergencyFund: row.emergencyFund,
    monthlyExpenses: row.monthlyExpenses,
    monthlyEmi: row.monthlyEmi,
    existingInvestments: {
      fd: row.invFd,
      mutualFunds: row.invMutualFunds,
      stocks: row.invStocks,
      gold: row.invGold,
      crypto: row.invCrypto,
      realEstate: row.invRealEstate,
      ppf: row.invPpf,
      epf: row.invEpf,
    },
    goals: row.goals.map((g) => ({
      type: g.type,
      label: g.label ?? undefined,
      targetAmount: g.targetAmount,
      targetYears: g.targetYears,
      priority: (g.priority as 1 | 2 | 3) ?? 2,
    })),
    riskAnswers: (row.riskAnswers as Record<string, number>) ?? {},
    horizon: row.horizon,
    monthlySip: row.monthlySip,
    lumpSum: row.lumpSum,
    annualInvestment: row.annualInvestment,
    maxSingleStockAllocationPct: row.maxSingleStockAllocationPct,
    styles: row.styles,
    marketCapPrefs: row.marketCapPrefs,
    preferredSectors: row.preferredSectors,
    avoidSectors: row.avoidSectors,
    taxSlab: row.taxSlab,
    used80cAmount: row.used80cAmount,
    capitalGainPref: row.capitalGainPref,
    riskScore: row.riskScore,
    riskBand: row.riskBand,
    financialHealthScore: row.financialHealthScore,
    investmentReadinessScore: row.investmentReadinessScore,
    onboardingSkipped: row.onboardingSkipped,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function saveOnboarding(
  userId: string,
  input: OnboardingInput,
  opts: { skipped?: boolean } = {},
): Promise<FinancialProfile> {
  const { score: riskScore, band: riskBand } = computeRiskScore(input);
  const health = computeFinancialHealth(input);
  const readiness = computeInvestmentReadiness(input);

  const data = {
    onboardingSkipped: opts.skipped ?? false,
    age: input.age,
    gender: input.gender,
    occupation: input.occupation,
    city: input.city,
    employmentType: input.employmentType,
    dependents: input.dependents,
    monthlyIncome: input.monthlyIncome,
    annualIncome: input.annualIncome,
    incomeStability: input.incomeStability,
    expectedSalaryGrowthPct: input.expectedSalaryGrowthPct,
    currentSavings: input.currentSavings,
    emergencyFund: input.emergencyFund,
    monthlyExpenses: input.monthlyExpenses,
    monthlyEmi: input.monthlyEmi,
    invFd: input.existingInvestments.fd,
    invMutualFunds: input.existingInvestments.mutualFunds,
    invStocks: input.existingInvestments.stocks,
    invGold: input.existingInvestments.gold,
    invCrypto: input.existingInvestments.crypto,
    invRealEstate: input.existingInvestments.realEstate,
    invPpf: input.existingInvestments.ppf,
    invEpf: input.existingInvestments.epf,
    riskAnswers: input.riskAnswers as Prisma.InputJsonValue,
    riskScore,
    riskBand,
    horizon: input.horizon,
    monthlySip: input.monthlySip,
    lumpSum: input.lumpSum,
    annualInvestment: input.annualInvestment,
    maxSingleStockAllocationPct: input.maxSingleStockAllocationPct,
    styles: input.styles,
    marketCapPrefs: input.marketCapPrefs,
    preferredSectors: input.preferredSectors,
    avoidSectors: input.avoidSectors,
    taxSlab: input.taxSlab,
    used80cAmount: input.used80cAmount,
    capitalGainPref: input.capitalGainPref,
    financialHealthScore: health.score,
    investmentReadinessScore: readiness.score,
  };

  const profile = await prisma.$transaction(async (tx) => {
    const saved = await tx.financialProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    await tx.goal.deleteMany({ where: { profileId: saved.id } });
    await tx.goal.createMany({
      data: input.goals.map((g) => ({
        profileId: saved.id,
        type: g.type,
        label: g.label ?? null,
        targetAmount: g.targetAmount,
        targetYears: g.targetYears,
        priority: g.priority,
      })),
    });
    await tx.user.update({ where: { id: userId }, data: { onboarded: true } });
    return tx.financialProfile.findUniqueOrThrow({ where: { id: saved.id }, include: { goals: true } });
  });

  return toProfileDto(profile);
}

/**
 * "Skip for now" — create a neutral default profile so a curious user can
 * explore every feature immediately. Risk answers are the LOWER-middle option
 * of each quiz question (computed, not hardcoded) so the derived band lands
 * MEDIUM — an unknown explorer must never default to aggressive advice. The
 * profile is flagged `onboardingSkipped` so the dashboard can prompt to
 * personalize, and any later real onboarding submit clears the flag.
 */
export async function skipOnboarding(userId: string): Promise<FinancialProfile> {
  const neutralAnswers = Object.fromEntries(
    RISK_QUESTIONS.map((q) => [q.id, q.options[Math.max(0, Math.floor(q.options.length / 2) - 1)]!.score]),
  );
  const defaults: OnboardingInput = {
    age: 30,
    gender: 'PREFER_NOT_TO_SAY',
    occupation: 'Exploring Seeker',
    city: 'India',
    employmentType: 'PRIVATE',
    dependents: 0,
    monthlyIncome: 60_000,
    annualIncome: 7_20_000,
    incomeStability: 'STABLE',
    expectedSalaryGrowthPct: 5,
    currentSavings: 1_50_000,
    emergencyFund: 1_20_000,
    monthlyExpenses: 35_000,
    monthlyEmi: 0,
    existingInvestments: { fd: 0, mutualFunds: 0, stocks: 0, gold: 0, crypto: 0, realEstate: 0, ppf: 0, epf: 0 },
    goals: [],
    riskAnswers: neutralAnswers,
    horizon: 'Y3_5',
    monthlySip: 10_000,
    lumpSum: 1_00_000,
    annualInvestment: 0,
    maxSingleStockAllocationPct: 25,
    styles: [],
    marketCapPrefs: [],
    preferredSectors: [],
    avoidSectors: [],
    taxSlab: 'S20',
    used80cAmount: 0,
    capitalGainPref: 'BALANCED',
  };
  return saveOnboarding(userId, defaults, { skipped: true });
}

export async function getProfile(userId: string): Promise<FinancialProfile> {
  const row = await prisma.financialProfile.findUnique({ where: { userId }, include: { goals: true } });
  if (!row) throw ApiError.notFound('Complete onboarding first', 'NO_PROFILE');
  return toProfileDto(row);
}

export async function getProfileOrNull(userId: string): Promise<FinancialProfile | null> {
  const row = await prisma.financialProfile.findUnique({ where: { userId }, include: { goals: true } });
  return row ? toProfileDto(row) : null;
}

// ── Dashboard summary ────────────────────────────────────────

const BAND_RETURN: Record<string, number> = { LOW: 9, MEDIUM: 11, AGGRESSIVE: 12.5, VERY_AGGRESSIVE: 14 };

export interface GoalProgressItem {
  type: string;
  label: string;
  targetAmount: number;
  inflatedTarget: number;
  targetYears: number;
  allocatedSip: number;
  requiredSip: number;
  fundedPct: number;
  onTrack: boolean;
}

export async function getDashboardSummary(userId: string) {
  const profile = await getProfile(userId);
  const inv = profile.existingInvestments;
  const investedTotal = Object.values(inv).reduce((a, b) => a + b, 0);
  const netWorth = profile.currentSavings + profile.emergencyFund + investedTotal;
  const surplus = profile.monthlyIncome - profile.monthlyExpenses - profile.monthlyEmi;

  const assetAllocation = [
    { label: 'Fixed Deposits', value: inv.fd },
    { label: 'Mutual Funds', value: inv.mutualFunds },
    { label: 'Stocks', value: inv.stocks },
    { label: 'Gold', value: inv.gold },
    { label: 'Crypto', value: inv.crypto },
    { label: 'Real Estate', value: inv.realEstate },
    { label: 'PPF', value: inv.ppf },
    { label: 'EPF', value: inv.epf },
    { label: 'Cash & Savings', value: profile.currentSavings + profile.emergencyFund },
  ].filter((a) => a.value > 0);

  const health = computeFinancialHealth(profile);
  const readiness = computeInvestmentReadiness(profile);

  // Goal progress — current corpus is split across goals by priority weight,
  // then each goal's remaining gap defines the SIP it actually needs.
  const expectedReturn = BAND_RETURN[profile.riskBand] ?? 11;
  const weights = profile.goals.map((g) => (g.priority === 1 ? 3 : g.priority === 2 ? 2 : 1));
  const weightSum = weights.reduce((a, b) => a + b, 0) || 1;
  const goalProgress: GoalProgressItem[] = profile.goals.map((g, i) => {
    const share = weights[i]! / weightSum;
    const corpusShare = investedTotal * share;
    const sipShare = profile.monthlySip * share;
    const inflatedTarget = inflate(g.targetAmount, DEFAULT_INFLATION_PCT, g.targetYears);
    const corpusFv = lumpSumFutureValue(corpusShare, expectedReturn, g.targetYears);
    const gap = Math.max(0, inflatedTarget - corpusFv);
    const requiredSip = gap > 0 ? sipRequiredForTarget(gap, expectedReturn, g.targetYears) : 0;
    const fundedPct = requiredSip > 0 ? Math.min(100, (sipShare / requiredSip) * 100) : 100;
    return {
      type: g.type,
      label: g.label ?? prettyGoal(g.type),
      targetAmount: g.targetAmount,
      inflatedTarget: Math.round(inflatedTarget),
      targetYears: g.targetYears,
      allocatedSip: Math.round(sipShare),
      requiredSip: Math.round(requiredSip),
      fundedPct: Math.round(fundedPct),
      onTrack: fundedPct >= 85,
    };
  });

  return {
    user: { name: (await prisma.user.findUnique({ where: { id: userId } }))?.name ?? 'Investor' },
    netWorth,
    investedTotal,
    monthlyInvestment: profile.monthlySip,
    monthlySurplus: surplus,
    riskScore: profile.riskScore,
    riskBand: profile.riskBand,
    financialHealth: health,
    investmentReadiness: readiness,
    assetAllocation,
    goalProgress,
    suggestions: buildSuggestions(profile, health, surplus),
    onboardingSkipped: profile.onboardingSkipped ?? false,
  };
}

function prettyGoal(type: string): string {
  return type
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

interface Suggestion {
  icon: 'shield' | 'trend' | 'tax' | 'warning' | 'spark';
  title: string;
  detail: string;
}

function buildSuggestions(profile: FinancialProfile, health: HealthScoreReport, surplus: number): Suggestion[] {
  const out: Suggestion[] = [];
  const emergencyMonths = profile.monthlyExpenses > 0 ? profile.emergencyFund / profile.monthlyExpenses : 0;

  if (emergencyMonths < 3) {
    out.push({
      icon: 'shield',
      title: 'Emergency fund first',
      detail: `You have ${emergencyMonths.toFixed(1)} months covered. Park ₹${Math.round(profile.monthlyExpenses * 3 - profile.emergencyFund).toLocaleString('en-IN')} more in a liquid fund before adding equity risk.`,
    });
  }

  const unused80c = Math.max(0, 150_000 - profile.used80cAmount);
  if (unused80c > 20_000 && ['S20', 'S30', 'S15'].includes(profile.taxSlab)) {
    out.push({
      icon: 'tax',
      title: 'Unused 80C headroom',
      detail: `₹${unused80c.toLocaleString('en-IN')} of Section 80C is unused. An ELSS SIP of ₹${Math.min(12_500, Math.round(unused80c / 12)).toLocaleString('en-IN')}/month captures the deduction with equity upside.`,
    });
  }

  if (surplus > 0 && profile.monthlySip < surplus * 0.5) {
    out.push({
      icon: 'trend',
      title: 'Room to invest more',
      detail: `You invest ₹${profile.monthlySip.toLocaleString('en-IN')} of a ₹${Math.round(surplus).toLocaleString('en-IN')} monthly surplus. A 10% annual SIP step-up compounds dramatically over ${profile.horizon === 'GT_10Y' ? 'your 10+ year' : 'your'} horizon.`,
    });
  }

  const inv = profile.existingInvestments;
  const totalInv = Object.values(inv).reduce((a, b) => a + b, 0);
  if (totalInv > 0 && inv.crypto / totalInv > 0.2) {
    out.push({
      icon: 'warning',
      title: 'Crypto concentration',
      detail: `Crypto is ${Math.round((inv.crypto / totalInv) * 100)}% of your investments — far above the 5–10% speculative ceiling most planners suggest.`,
    });
  }
  if (totalInv > 0 && inv.fd / totalInv > 0.6 && (profile.riskBand === 'AGGRESSIVE' || profile.riskBand === 'VERY_AGGRESSIVE')) {
    out.push({
      icon: 'trend',
      title: 'FD-heavy for your risk profile',
      detail: `${Math.round((inv.fd / totalInv) * 100)}% sits in FDs while your risk profile is ${profile.riskBand.toLowerCase().replace('_', ' ')} — post-tax FD returns barely beat inflation.`,
    });
  }

  if (out.length < 3 && health.suggestions[0]) {
    out.push({ icon: 'spark', title: 'Health check', detail: health.suggestions[0] });
  }
  return out.slice(0, 4);
}

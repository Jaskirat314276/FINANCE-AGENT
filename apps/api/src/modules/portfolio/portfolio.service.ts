import type { GeneratedPortfolio } from '@seeker/shared';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../middleware/error';
import { getProfile } from '../profile/profile.service';
import { generatePortfolio, monteCarlo, type EngineParams } from './engine';

export interface GenerateOptions {
  amount: number;
  monthlySip: number;
  riskOverride?: EngineParams['riskBand'];
  horizonOverride?: EngineParams['horizon'];
  name?: string;
  targetAmount?: number;
}

export async function generateForUser(userId: string, opts: GenerateOptions): Promise<GeneratedPortfolio> {
  const profile = await getProfile(userId);
  return generatePortfolio(profile, {
    amount: opts.amount,
    monthlySip: opts.monthlySip,
    riskBand: opts.riskOverride ?? profile.riskBand,
    riskScore: profile.riskScore,
    horizon: opts.horizonOverride ?? profile.horizon,
    name: opts.name,
    targetAmount: opts.targetAmount,
  });
}

export async function savePortfolio(userId: string, portfolio: GeneratedPortfolio) {
  const saved = await prisma.portfolio.create({
    data: {
      userId,
      name: portfolio.name,
      amount: portfolio.amount,
      monthlySip: portfolio.monthlySip,
      riskBand: portfolio.riskBand,
      riskScore: portfolio.riskScore,
      horizon: portfolio.horizon,
      data: portfolio as unknown as Prisma.InputJsonValue,
    },
  });
  return { ...portfolio, id: saved.id, createdAt: saved.createdAt.toISOString() };
}

export async function listPortfolios(userId: string) {
  const rows = await prisma.portfolio.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  return rows.map((r) => ({ ...(r.data as unknown as GeneratedPortfolio), id: r.id, createdAt: r.createdAt.toISOString() }));
}

export async function getPortfolio(userId: string, id: string): Promise<GeneratedPortfolio> {
  const row = await prisma.portfolio.findFirst({ where: { id, userId } });
  if (!row) throw ApiError.notFound('Portfolio not found');
  return { ...(row.data as unknown as GeneratedPortfolio), id: row.id, createdAt: row.createdAt.toISOString() };
}

export async function deletePortfolio(userId: string, id: string): Promise<void> {
  const result = await prisma.portfolio.deleteMany({ where: { id, userId } });
  if (result.count === 0) throw ApiError.notFound('Portfolio not found');
}

/**
 * Risk simulator — stress-test an amount at the user's risk band against
 * historical-style shocks, plus a Monte Carlo distribution.
 */
export async function simulateRisk(userId: string, amount: number, years: number) {
  const profile = await getProfile(userId);
  const bandVol: Record<string, { cagr: number; vol: number }> = {
    LOW: { cagr: 9, vol: 7 },
    MEDIUM: { cagr: 11.5, vol: 12 },
    AGGRESSIVE: { cagr: 13, vol: 17 },
    VERY_AGGRESSIVE: { cagr: 14.5, vol: 22 },
  };
  const { cagr, vol } = bandVol[profile.riskBand]!;
  const scenarios = [
    { name: 'Correction (−10%)', shockPct: -10, historicalExample: 'Typical yearly pullback' },
    { name: 'Bear market (−25%)', shockPct: -25, historicalExample: '2011, 2015–16 style' },
    { name: 'Crash (−40%)', shockPct: -40, historicalExample: '2008, March 2020 style' },
  ].map((s) => {
    const afterShock = amount * (1 + s.shockPct / 100);
    const monthlyRate = Math.pow(1 + cagr / 100, 1 / 12) - 1;
    const monthsToRecover = Math.ceil(Math.log(amount / afterShock) / Math.log(1 + monthlyRate));
    return { ...s, valueAfter: Math.round(afterShock), estRecoveryMonths: monthsToRecover };
  });
  return {
    riskBand: profile.riskBand,
    assumedCagrPct: cagr,
    assumedVolPct: vol,
    scenarios,
    monteCarlo: monteCarlo({ lumpSum: amount, monthlySip: 0, years: Math.max(3, years), cagrPct: cagr, volPct: vol }),
  };
}

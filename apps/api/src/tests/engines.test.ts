/**
 * Engine smoke tests — pure logic, no DB or network required
 * (market providers resolve via the mock provider when MARKET_PROVIDERS=mock).
 * Run: npm run test:engines -w @seeker/api
 */
import './setup-env';
import assert from 'node:assert';
import type { FinancialProfile } from '@seeker/shared';
import { computeTechnicals, rsi, sma, macd } from '../modules/market/indicators';
import { computeFinancialHealth, computeInvestmentReadiness, computeRiskScore } from '../modules/profile/scoring';
import { buildAllocation, generatePortfolio, monteCarlo, portfolioStats } from '../modules/portfolio/engine';
import * as market from '../modules/market/market.service';
import { demoAdvise } from '../modules/advisor/demo-advisor';
import { detectAmount, detectSymbols } from '../modules/advisor/context';

const profile: FinancialProfile = {
  id: 't',
  userId: 't',
  age: 29,
  gender: 'MALE',
  occupation: 'Engineer',
  city: 'Bengaluru',
  employmentType: 'PRIVATE',
  dependents: 1,
  monthlyIncome: 150_000,
  annualIncome: 1_800_000,
  incomeStability: 'STABLE',
  expectedSalaryGrowthPct: 10,
  currentSavings: 400_000,
  emergencyFund: 360_000,
  monthlyExpenses: 60_000,
  monthlyEmi: 15_000,
  existingInvestments: { fd: 200_000, mutualFunds: 350_000, stocks: 150_000, gold: 50_000, crypto: 25_000, realEstate: 0, ppf: 120_000, epf: 280_000 },
  goals: [{ type: 'HOUSE', targetAmount: 5_000_000, targetYears: 7, priority: 1 }],
  riskAnswers: { drop25: 3, sleep: 2, choice: 3, gains: 3, income_loss: 3, experience: 2, loss_tolerance: 2 },
  horizon: 'Y5_10',
  monthlySip: 40_000,
  lumpSum: 200_000,
  annualInvestment: 480_000,
  maxSingleStockAllocationPct: 20,
  styles: ['GROWTH'],
  marketCapPrefs: ['LARGE_CAP', 'MID_CAP'],
  preferredSectors: ['TECHNOLOGY', 'BANKING'],
  avoidSectors: [],
  taxSlab: 'S30',
  used80cAmount: 100_000,
  capitalGainPref: 'LONG_TERM',
  riskScore: 62,
  riskBand: 'AGGRESSIVE',
  financialHealthScore: 0,
  investmentReadinessScore: 0,
  createdAt: '',
  updatedAt: '',
};

async function run() {
  // ── indicators ────────────────────────────────────────────
  const up = Array.from({ length: 260 }, (_, i) => 100 + i * 0.5);
  assert.ok(Math.abs((sma(up, 20) ?? 0) - (up.slice(-20).reduce((a, b) => a + b) / 20)) < 1e-9, 'sma exact');
  const r = rsi(up, 14);
  assert.ok(r !== null && r > 90, `rsi of monotonic uptrend should be ~100, got ${r}`);
  const m = macd(up);
  assert.ok(m !== null && m.line > 0, 'macd positive in uptrend');

  const candles = await market.getCandles('TCS', '3Y');
  assert.ok(candles.length > 400, `mock candles length ${candles.length}`);
  const tech = computeTechnicals('TCS', candles);
  assert.ok(tech.rsi14 !== null && tech.rsi14 >= 0 && tech.rsi14 <= 100, 'rsi in range');
  assert.ok(tech.sma200 !== null, 'sma200 computed');
  assert.ok(['BULLISH', 'BEARISH', 'NEUTRAL'].includes(tech.trend), 'trend valid');

  // ── scoring ───────────────────────────────────────────────
  const risk = computeRiskScore(profile);
  assert.ok(risk.score >= 0 && risk.score <= 100, 'risk score in range');
  const conservative = computeRiskScore({ ...profile, age: 62, riskAnswers: { drop25: 0, sleep: 0, choice: 0, gains: 1, income_loss: 0, experience: 0, loss_tolerance: 0 }, incomeStability: 'UNSTABLE' });
  assert.ok(conservative.score < risk.score, 'conservative answers → lower score');
  assert.strictEqual(conservative.band, 'LOW', `expected LOW band, got ${conservative.band}`);

  const health = computeFinancialHealth(profile);
  assert.ok(health.score > 40 && health.score <= 100, `health score sensible: ${health.score}`);
  assert.ok(health.breakdown.reduce((a, b) => a + b.max, 0) === 100, 'health max sums to 100');
  const readiness = computeInvestmentReadiness(profile);
  assert.ok(readiness.score > 50, `readiness for solid profile: ${readiness.score}`);

  // ── allocation ────────────────────────────────────────────
  const { weights } = buildAllocation(profile, { amount: 500_000, monthlySip: 40_000, riskBand: 'AGGRESSIVE', riskScore: 62, horizon: 'Y5_10' });
  const total = [...weights.values()].reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 100) < 0.01, `allocation sums to 100, got ${total}`);
  // small-cap excluded due to marketCapPrefs [LARGE, MID]
  assert.ok((weights.get('STOCKS_SMALL') ?? 0) < 0.01, 'small-cap excluded per prefs');

  const shortHorizon = buildAllocation(profile, { amount: 500_000, monthlySip: 0, riskBand: 'AGGRESSIVE', riskScore: 62, horizon: 'LT_1Y' });
  const equityShort = ['STOCKS_LARGE', 'STOCKS_MID', 'STOCKS_SMALL'].reduce((a, c) => a + (shortHorizon.weights.get(c as never) ?? 0), 0);
  assert.ok(equityShort < 20, `short horizon slashes direct equity, got ${equityShort}`);

  const stats = portfolioStats(weights);
  assert.ok(stats.cagr > 8 && stats.cagr < 18, `cagr sensible: ${stats.cagr}`);
  assert.ok(stats.vol > 5 && stats.vol < 30, `vol sensible: ${stats.vol}`);

  // ── monte carlo ───────────────────────────────────────────
  const mc = monteCarlo({ lumpSum: 100_000, monthlySip: 10_000, years: 10, cagrPct: 12, volPct: 15 });
  assert.strictEqual(mc.percentiles.p50.length, 10, 'yearly percentiles');
  const last = mc.percentiles.p50[9]!;
  assert.ok(last > mc.invested[9]! * 0.8, 'median should be near/above invested');
  assert.ok(mc.percentiles.p90[9]! > mc.percentiles.p10[9]!, 'fan ordering');
  assert.ok(mc.probLoss >= 0 && mc.probLoss < 0.5, `probLoss sensible: ${mc.probLoss}`);
  const mc2 = monteCarlo({ lumpSum: 100_000, monthlySip: 10_000, years: 10, cagrPct: 12, volPct: 15 });
  assert.strictEqual(mc.percentiles.p50[9], mc2.percentiles.p50[9], 'deterministic RNG');

  // ── full portfolio ────────────────────────────────────────
  const pf = await generatePortfolio(profile, { amount: 1_000_000, monthlySip: 40_000, riskBand: 'AGGRESSIVE', riskScore: 62, horizon: 'Y5_10' });
  const allocSum = pf.allocation.reduce((a, b) => a + b.pct, 0);
  assert.ok(Math.abs(allocSum - 100) < 1.5, `portfolio allocation ≈100: ${allocSum}`);
  assert.ok(pf.stocks.length >= 3, `stock picks: ${pf.stocks.length}`);
  for (const s of pf.stocks) {
    assert.ok(s.weightPct <= profile.maxSingleStockAllocationPct + 0.01, `${s.symbol} within single-stock cap`);
    assert.ok(s.rationale.length > 5, 'pick has rationale');
  }
  const sectors = new Set(pf.stocks.map((s) => s.sector));
  assert.ok(sectors.size >= 2, 'diversified across sectors');
  assert.ok(pf.funds.length >= 2, 'funds selected');
  // ELSS should appear (S30 slab, 50k unused 80C)
  assert.ok(pf.funds.some((f) => f.name.includes('ELSS')), 'ELSS suggested for unused 80C');

  // ── advisor context helpers ───────────────────────────────
  assert.deepStrictEqual(detectSymbols('Should I buy TCS today?'), ['TCS']);
  assert.ok(detectSymbols('compare Infosys vs TCS').includes('INFY'), 'alias detection');
  assert.strictEqual(detectAmount('invest ₹50,000 today'), 50_000);
  assert.strictEqual(detectAmount('build a 10 lakh portfolio'), 1_000_000);
  assert.strictEqual(detectAmount('1.5 cr corpus'), 15_000_000);

  // ── demo advisor ──────────────────────────────────────────
  const snapshot = await market.getMarketSnapshot();
  const overview = await market.getOverview('TCS');
  const advice = demoAdvise({ profile, snapshot, overviews: [overview], portfolio: null, question: 'Should I buy TCS?', amount: 100_000 });
  assert.ok(advice.executiveSummary.length > 50, 'exec summary substantial');
  assert.ok(advice.confidence >= 0 && advice.confidence <= 100, 'confidence range');
  assert.ok(advice.whyThisFitsYourProfile.length >= 3, 'profile-fit bullets');
  assert.ok(advice.disclaimer.length > 10, 'disclaimer present');
  const pfAdvice = demoAdvise({ profile, snapshot, overviews: [], portfolio: pf, question: 'Build a portfolio', amount: 1_000_000 });
  assert.ok(pfAdvice.suggestedAllocation.length >= 4, 'portfolio advice carries allocation');

  console.log('✅ All engine smoke tests passed');
}

run().catch((err) => {
  console.error('❌ Engine test failed:', err.message);
  process.exit(1);
});

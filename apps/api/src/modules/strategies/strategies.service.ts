import type { FinancialProfile, StrategyBlueprint } from '@seeker/shared';
import { HORIZON_YEARS } from '@seeker/shared';
import { getProfileOrNull } from '../profile/profile.service';

/**
 * Curated strategy blueprints + a personalised fit score.
 * Fit = risk-band distance (50%) + horizon match (30%) + style match (20%).
 */

const BLUEPRINTS: StrategyBlueprint[] = [
  {
    key: 'CONSERVATIVE',
    name: 'Conservative',
    tagline: 'Protect first, grow steadily',
    allocation: [
      { label: 'Debt funds', pct: 40 },
      { label: 'Large-cap stocks & index', pct: 25 },
      { label: 'Equity MF', pct: 10 },
      { label: 'Gold', pct: 10 },
      { label: 'Cash / liquid', pct: 15 },
    ],
    expectedCagrPct: { min: 8, max: 10 },
    risk: 'LOW',
    volatilityPct: 7,
    suitableFor: ['First-time investors', 'Horizon under 3 years', 'Retirees needing stability'],
    horizon: '1–3+ years',
    notes: ['Rarely falls more than ~10% in a bad year', 'Beats FDs post-tax without equity-level swings'],
  },
  {
    key: 'BALANCED',
    name: 'Balanced',
    tagline: 'The 60/40 of Indian investing',
    allocation: [
      { label: 'Large-cap stocks & index', pct: 40 },
      { label: 'Equity MF', pct: 15 },
      { label: 'Mid-cap stocks', pct: 5 },
      { label: 'Debt funds', pct: 25 },
      { label: 'Gold', pct: 10 },
      { label: 'Cash', pct: 5 },
    ],
    expectedCagrPct: { min: 10, max: 12 },
    risk: 'MODERATE',
    volatilityPct: 12,
    suitableFor: ['Moderate risk takers', '3–7 year goals', 'Investors wanting equity growth with a cushion'],
    horizon: '3–7 years',
    notes: ['Classic risk-balanced core', 'Rebalancing between sleeves adds discipline'],
  },
  {
    key: 'GROWTH',
    name: 'Growth',
    tagline: 'Equity-led compounding',
    allocation: [
      { label: 'Large-cap stocks', pct: 30 },
      { label: 'Mid-cap stocks', pct: 15 },
      { label: 'Index ETFs', pct: 17 },
      { label: 'Equity MF', pct: 15 },
      { label: 'Small-cap', pct: 6 },
      { label: 'Debt + Gold + Cash', pct: 17 },
    ],
    expectedCagrPct: { min: 12, max: 14 },
    risk: 'HIGH',
    volatilityPct: 16,
    suitableFor: ['5+ year horizons', 'Stable incomes', 'Investors comfortable with 25% drawdowns'],
    horizon: '5–10 years',
    notes: ['Equity ~83% — expect sharp drawdowns on the way to higher CAGR'],
  },
  {
    key: 'AGGRESSIVE',
    name: 'Aggressive',
    tagline: 'Maximum growth, maximum stomach',
    allocation: [
      { label: 'Large-cap stocks', pct: 30 },
      { label: 'Mid-cap stocks', pct: 20 },
      { label: 'Small-cap stocks', pct: 12 },
      { label: 'Index + Equity MF', pct: 28 },
      { label: 'Debt + Gold + Cash', pct: 10 },
    ],
    expectedCagrPct: { min: 13, max: 17 },
    risk: 'VERY_HIGH',
    volatilityPct: 21,
    suitableFor: ['10+ year horizons', 'Young investors', 'High and stable surplus'],
    horizon: '10+ years',
    notes: ['Can fall 35–50% in crashes — position sizing and SIP discipline are everything'],
  },
  {
    key: 'HIGH_DIVIDEND',
    name: 'High Dividend',
    tagline: 'Cash flow while you hold',
    allocation: [
      { label: 'Dividend large-caps (ITC, Coal India type)', pct: 45 },
      { label: 'Dividend-yield MF', pct: 20 },
      { label: 'REITs / InvITs', pct: 10 },
      { label: 'Debt funds', pct: 20 },
      { label: 'Cash', pct: 5 },
    ],
    expectedCagrPct: { min: 9, max: 12 },
    risk: 'MODERATE',
    volatilityPct: 11,
    suitableFor: ['Passive-income seekers', 'Semi-retired investors', 'Lower churn temperament'],
    horizon: '3+ years',
    notes: ['Dividends are taxed at slab rate — factor that in', 'Yield 2.5–4% plus moderate growth'],
  },
  {
    key: 'VALUE',
    name: 'Value',
    tagline: 'Buy rupees for 60 paise',
    allocation: [
      { label: 'Undervalued large-caps', pct: 40 },
      { label: 'Contrarian mid-caps', pct: 20 },
      { label: 'Value/dividend MF', pct: 20 },
      { label: 'Debt + Cash', pct: 20 },
    ],
    expectedCagrPct: { min: 11, max: 14 },
    risk: 'HIGH',
    volatilityPct: 15,
    suitableFor: ['Patient investors', 'Contrarians', '5+ year horizons'],
    horizon: '5+ years',
    notes: ['Low P/E + strong balance sheets', 'Value can underperform for years before re-rating'],
  },
  {
    key: 'MOMENTUM',
    name: 'Momentum',
    tagline: 'Ride strength, cut weakness',
    allocation: [
      { label: 'Momentum stocks (50/200-DMA leaders)', pct: 50 },
      { label: 'Momentum index fund', pct: 25 },
      { label: 'Debt (dry powder)', pct: 20 },
      { label: 'Cash', pct: 5 },
    ],
    expectedCagrPct: { min: 12, max: 18 },
    risk: 'VERY_HIGH',
    volatilityPct: 22,
    suitableFor: ['Active investors', 'Rule-followers who exit without emotion'],
    horizon: '1–5 years (active)',
    notes: ['Needs strict stop-losses and monthly review', 'Whipsaws hurt in sideways markets'],
  },
  {
    key: 'SWING',
    name: 'Swing',
    tagline: 'Weeks-to-months tactical trades',
    allocation: [
      { label: 'Tactical stock positions (3–6 at a time)', pct: 40 },
      { label: 'Index ETF core', pct: 25 },
      { label: 'Debt / liquid (between trades)', pct: 30 },
      { label: 'Hedging budget', pct: 5 },
    ],
    expectedCagrPct: { min: 10, max: 20 },
    risk: 'VERY_HIGH',
    volatilityPct: 24,
    suitableFor: ['Experienced traders only', 'People with time to monitor daily'],
    horizon: 'Weeks–months per position',
    notes: ['Short-term capital gains taxed at 20% — returns must clear that bar', 'Not advisable as a core strategy'],
  },
  {
    key: 'LONG_TERM',
    name: 'Long Term Compounder',
    tagline: 'Buy quality, sit tight for a decade',
    allocation: [
      { label: 'Quality large-caps (high ROCE)', pct: 45 },
      { label: 'Index funds', pct: 25 },
      { label: 'Quality mid-caps', pct: 15 },
      { label: 'Gold', pct: 8 },
      { label: 'Debt', pct: 7 },
    ],
    expectedCagrPct: { min: 12, max: 15 },
    risk: 'HIGH',
    volatilityPct: 15,
    suitableFor: ['10+ year wealth creation', 'Low-maintenance investors', 'SIP-first temperaments'],
    horizon: '10+ years',
    notes: ['The strategy most millionaires actually used', 'Success factor is not selling in crashes'],
  },
  {
    key: 'RETIREMENT',
    name: 'Retirement Glidepath',
    tagline: 'Equity early, safety as you approach',
    allocation: [
      { label: 'Equity (stocks + MF + index)', pct: 60 },
      { label: 'NPS / EPF / PPF', pct: 20 },
      { label: 'Debt funds', pct: 12 },
      { label: 'Gold', pct: 8 },
    ],
    expectedCagrPct: { min: 10, max: 13 },
    risk: 'MODERATE',
    volatilityPct: 13,
    suitableFor: ['Retirement planners of any age', 'Tax-efficiency seekers (NPS 80CCD)'],
    horizon: 'Until retirement',
    notes: ['Shift ~5% from equity to debt each year in the final decade', 'NPS adds ₹50k extra deduction under 80CCD(1B)'],
  },
  {
    key: 'GOAL_BASED',
    name: 'Goal Based Buckets',
    tagline: 'Each goal gets its own risk budget',
    allocation: [
      { label: 'Short-term goals (<3y): debt + liquid', pct: 30 },
      { label: 'Medium goals (3–7y): balanced equity', pct: 35 },
      { label: 'Long goals (7y+): aggressive equity', pct: 35 },
    ],
    expectedCagrPct: { min: 9, max: 13 },
    risk: 'MODERATE',
    volatilityPct: 12,
    suitableFor: ['Multiple simultaneous goals', 'People who panic when "one number" falls'],
    horizon: 'Per goal',
    notes: ['Never fund a short-term goal with equity', 'Each bucket rebalances independently'],
  },
];

const BAND_ORDER = ['LOW', 'MEDIUM', 'AGGRESSIVE', 'VERY_AGGRESSIVE'];
const RISK_ORDER = ['LOW', 'MODERATE', 'HIGH', 'VERY_HIGH'];

function fitFor(profile: FinancialProfile, bp: StrategyBlueprint): { score: number; reason: string } {
  const userIdx = BAND_ORDER.indexOf(profile.riskBand);
  const bpIdx = RISK_ORDER.indexOf(bp.risk);
  const riskDistance = Math.abs(userIdx - bpIdx);
  const riskScore = Math.max(0, 50 - riskDistance * 18);

  const years = HORIZON_YEARS[profile.horizon];
  let horizonScore = 15;
  if (bp.key === 'CONSERVATIVE') horizonScore = years <= 3 ? 30 : 12;
  else if (bp.key === 'SWING' || bp.key === 'MOMENTUM') horizonScore = years <= 5 ? 22 : 10;
  else if (bp.key === 'AGGRESSIVE' || bp.key === 'LONG_TERM') horizonScore = years >= 7 ? 30 : years >= 4 ? 18 : 5;
  else horizonScore = years >= 3 ? 25 : 15;

  let styleScore = 8;
  if (bp.key === 'HIGH_DIVIDEND' && profile.styles.includes('DIVIDEND')) styleScore = 20;
  if (bp.key === 'VALUE' && profile.styles.includes('VALUE')) styleScore = 20;
  if (bp.key === 'MOMENTUM' && profile.styles.includes('MOMENTUM')) styleScore = 20;
  if (bp.key === 'GROWTH' && profile.styles.includes('GROWTH')) styleScore = 20;
  if (bp.key === 'RETIREMENT' && profile.goals.some((g) => g.type === 'RETIREMENT')) styleScore = 20;
  if (bp.key === 'GOAL_BASED' && profile.goals.length >= 3) styleScore = 20;
  if (bp.key === 'BALANCED') styleScore = 12;

  const score = Math.min(100, Math.round(riskScore + horizonScore + styleScore));
  const reason =
    riskDistance === 0
      ? 'Matches your risk band directly'
      : riskDistance === 1
        ? 'One notch from your risk band — workable with sizing'
        : 'Significantly misaligned with your risk profile';
  return { score, reason };
}

export async function getStrategies(userId: string | null): Promise<StrategyBlueprint[]> {
  const profile = userId ? await getProfileOrNull(userId) : null;
  if (!profile) return BLUEPRINTS;
  return BLUEPRINTS.map((bp) => {
    const { score, reason } = fitFor(profile, bp);
    return { ...bp, fitScore: score, fitReason: reason };
  }).sort((a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0));
}

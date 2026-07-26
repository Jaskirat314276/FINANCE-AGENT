import type { FinancialProfileInput, HealthScoreReport, RiskBand, ScoreBreakdownItem } from '@seeker/shared';
import { MAX_RISK_RAW, RISK_QUESTIONS, riskBandFromScore, EMERGENCY_FUND_TARGET_MONTHS } from '@seeker/shared';

/**
 * Deterministic scoring engines.
 * Risk = willingness (scenario quiz, 70%) + capacity (life situation, 30%).
 * All scores are 0–100 and explainable via breakdowns.
 */

export function computeRiskScore(input: FinancialProfileInput): { score: number; band: RiskBand } {
  // — Willingness: quiz answers
  let raw = 0;
  for (const q of RISK_QUESTIONS) {
    const ans = input.riskAnswers[q.id];
    if (typeof ans === 'number') raw += Math.min(ans, Math.max(...q.options.map((o) => o.score)));
  }
  const willingness = MAX_RISK_RAW > 0 ? (raw / MAX_RISK_RAW) * 100 : 50;

  // — Capacity: can their life absorb drawdowns?
  let capacity = 50;
  if (input.age < 30) capacity += 20;
  else if (input.age < 40) capacity += 10;
  else if (input.age < 50) capacity += 0;
  else if (input.age < 60) capacity -= 12;
  else capacity -= 25;

  const emergencyMonths = input.monthlyExpenses > 0 ? input.emergencyFund / input.monthlyExpenses : 0;
  if (emergencyMonths >= EMERGENCY_FUND_TARGET_MONTHS) capacity += 12;
  else if (emergencyMonths >= 3) capacity += 4;
  else capacity -= 12;

  switch (input.incomeStability) {
    case 'VERY_STABLE':
      capacity += 8;
      break;
    case 'STABLE':
      capacity += 4;
      break;
    case 'VARIABLE':
      capacity -= 4;
      break;
    case 'UNSTABLE':
      capacity -= 12;
      break;
  }

  capacity -= Math.min(input.dependents * 4, 16);

  const surplus = input.monthlyIncome - input.monthlyExpenses - input.monthlyEmi;
  const surplusRate = input.monthlyIncome > 0 ? surplus / input.monthlyIncome : 0;
  if (surplusRate >= 0.4) capacity += 10;
  else if (surplusRate >= 0.2) capacity += 5;
  else if (surplusRate < 0.05) capacity -= 10;

  capacity = clamp(capacity, 0, 100);

  const score = Math.round(clamp(willingness * 0.7 + capacity * 0.3, 0, 100));
  return { score, band: riskBandFromScore(score) };
}

export function computeFinancialHealth(input: FinancialProfileInput): HealthScoreReport {
  const breakdown: ScoreBreakdownItem[] = [];
  const suggestions: string[] = [];

  const income = input.monthlyIncome || 1;
  const emergencyMonths = input.monthlyExpenses > 0 ? input.emergencyFund / input.monthlyExpenses : 0;
  const emergencyScore = clamp((emergencyMonths / EMERGENCY_FUND_TARGET_MONTHS) * 25, 0, 25);
  breakdown.push({
    key: 'emergency',
    label: 'Emergency fund',
    score: Math.round(emergencyScore),
    max: 25,
    comment: `${emergencyMonths.toFixed(1)} months of expenses covered (target ${EMERGENCY_FUND_TARGET_MONTHS})`,
  });
  if (emergencyMonths < 3)
    suggestions.push(
      `Build your emergency fund to at least 3 months of expenses (₹${Math.round(input.monthlyExpenses * 3).toLocaleString('en-IN')}) before adding equity risk.`,
    );

  const surplus = input.monthlyIncome - input.monthlyExpenses - input.monthlyEmi;
  const savingsRate = surplus / income;
  const savingsScore = clamp((savingsRate / 0.3) * 25, 0, 25);
  breakdown.push({
    key: 'savings',
    label: 'Savings rate',
    score: Math.round(savingsScore),
    max: 25,
    comment: `You save ${(savingsRate * 100).toFixed(0)}% of income (target 30%+)`,
  });
  if (savingsRate < 0.15) suggestions.push('Aim to push your savings rate above 15–20% — automate a SIP on salary day.');

  const emiRatio = input.monthlyEmi / income;
  const debtScore = clamp((1 - emiRatio / 0.4) * 20, 0, 20);
  breakdown.push({
    key: 'debt',
    label: 'Debt burden',
    score: Math.round(debtScore),
    max: 20,
    comment:
      input.monthlyEmi > 0
        ? `EMIs consume ${(emiRatio * 100).toFixed(0)}% of income (keep under 30–40%)`
        : 'No EMIs — excellent',
  });
  if (emiRatio > 0.4) suggestions.push('EMIs above 40% of income crowd out investing — consider prepaying the costliest loan first.');

  const inv = input.existingInvestments;
  const buckets = [inv.fd, inv.mutualFunds, inv.stocks, inv.gold, inv.ppf, inv.epf, inv.realEstate].filter((v) => v > 0).length;
  const totalInvested = Object.values(inv).reduce((a, b) => a + b, 0);
  const diversificationScore = clamp(buckets * 3 + (totalInvested > 0 ? 3 : 0), 0, 15);
  breakdown.push({
    key: 'diversification',
    label: 'Diversification',
    score: Math.round(diversificationScore),
    max: 15,
    comment: totalInvested > 0 ? `Invested across ${buckets} asset type${buckets === 1 ? '' : 's'}` : 'No investments yet',
  });
  const cryptoShare = totalInvested > 0 ? inv.crypto / totalInvested : 0;
  if (cryptoShare > 0.2) suggestions.push(`Crypto is ${(cryptoShare * 100).toFixed(0)}% of your investments — consider trimming to under 10% given its volatility.`);

  const stabilityScore =
    input.incomeStability === 'VERY_STABLE' ? 10 : input.incomeStability === 'STABLE' ? 8 : input.incomeStability === 'VARIABLE' ? 5 : 2;
  breakdown.push({
    key: 'stability',
    label: 'Income stability',
    score: stabilityScore,
    max: 10,
    comment: input.incomeStability.replace('_', ' ').toLowerCase(),
  });

  const goalScore = clamp(input.goals.length > 0 ? 5 : 0, 0, 5);
  breakdown.push({
    key: 'goals',
    label: 'Goal clarity',
    score: goalScore,
    max: 5,
    comment: input.goals.length > 0 ? `${input.goals.length} goal${input.goals.length === 1 ? '' : 's'} defined` : 'No goals defined',
  });

  const score = Math.round(breakdown.reduce((a, b) => a + b.score, 0));
  const grade = score >= 80 ? 'EXCELLENT' : score >= 65 ? 'GOOD' : score >= 45 ? 'FAIR' : 'NEEDS_ATTENTION';
  if (suggestions.length === 0) suggestions.push('Solid foundation — keep SIPs consistent and review allocation twice a year.');

  return { score, grade, breakdown, suggestions };
}

export function computeInvestmentReadiness(input: FinancialProfileInput): { score: number; notes: string[] } {
  const notes: string[] = [];
  let score = 0;

  const emergencyMonths = input.monthlyExpenses > 0 ? input.emergencyFund / input.monthlyExpenses : 0;
  if (emergencyMonths >= 6) score += 30;
  else if (emergencyMonths >= 3) {
    score += 20;
    notes.push('Emergency fund covers 3+ months — good, 6 is safer.');
  } else notes.push('Emergency fund below 3 months — fix this before aggressive equity exposure.');

  const surplus = input.monthlyIncome - input.monthlyExpenses - input.monthlyEmi;
  if (surplus > 0) {
    score += surplus / input.monthlyIncome >= 0.2 ? 25 : 15;
  } else {
    notes.push('You currently spend more than you earn — investing should wait until cash flow is positive.');
  }

  const emiRatio = input.monthlyIncome > 0 ? input.monthlyEmi / input.monthlyIncome : 0;
  if (emiRatio <= 0.3) score += 15;
  else notes.push('High EMI load reduces how much market risk you should take.');

  const answered = Object.keys(input.riskAnswers).length;
  score += Math.min(10, answered * 1.5);

  if (input.monthlySip > 0 && surplus > 0) {
    score += input.monthlySip <= surplus ? 20 : 5;
    if (input.monthlySip > surplus) notes.push(`Planned SIP (₹${input.monthlySip.toLocaleString('en-IN')}) exceeds your monthly surplus — start smaller and step up.`);
  } else if (input.lumpSum > 0) {
    score += 15;
  }

  return { score: Math.round(clamp(score, 0, 100)), notes };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

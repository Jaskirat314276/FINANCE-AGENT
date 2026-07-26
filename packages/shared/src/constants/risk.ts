import type { RiskBand } from '../types/profile';

/**
 * Scenario-based risk questionnaire (Step 5).
 * Each option carries a 0–4 score; the server converts total → 0–100
 * and derives the band. Never ask "what is your risk tolerance" directly.
 */
export interface RiskQuestion {
  id: string;
  question: string;
  options: { label: string; score: number }[];
}

export const RISK_QUESTIONS: RiskQuestion[] = [
  {
    id: 'drop25',
    question: 'Your portfolio drops 25% in a market crash. What do you actually do?',
    options: [
      { label: 'Sell everything — I cannot watch it fall further', score: 0 },
      { label: 'Sell a part and move to FDs until things settle', score: 1 },
      { label: 'Do nothing and wait for recovery', score: 2 },
      { label: 'Invest a little more at lower prices', score: 3 },
      { label: 'Deploy aggressively — crashes are sales', score: 4 },
    ],
  },
  {
    id: 'sleep',
    question: 'Which statement best matches how you sleep during volatile markets?',
    options: [
      { label: 'I check prices constantly and feel anxious', score: 0 },
      { label: 'I feel uneasy but manage', score: 1 },
      { label: 'Mostly unaffected', score: 2 },
      { label: 'Volatility rarely crosses my mind', score: 3 },
      { label: 'I enjoy volatility — it creates opportunity', score: 4 },
    ],
  },
  {
    id: 'choice',
    question: 'Pick the investment you would actually choose:',
    options: [
      { label: 'FD: 7% assured', score: 0 },
      { label: 'Debt fund: ~8% with tiny fluctuations', score: 1 },
      { label: 'Index fund: ~11–12% with swings of ±20%', score: 2 },
      { label: 'Stock portfolio: ~14% potential, swings of ±35%', score: 3 },
      { label: 'Small-caps: 20%+ potential, can halve in a bad year', score: 4 },
    ],
  },
  {
    id: 'gains',
    question: 'A stock you own doubles in 6 months. You would…',
    options: [
      { label: 'Sell fully — lock the profit', score: 1 },
      { label: 'Sell half, let the rest ride', score: 2 },
      { label: 'Hold — the thesis is intact', score: 3 },
      { label: 'Buy more — winners keep winning', score: 4 },
    ],
  },
  {
    id: 'income_loss',
    question: 'If you lost your primary income tomorrow, your investments would need to…',
    options: [
      { label: 'Be withdrawn immediately to survive', score: 0 },
      { label: 'Partially fund expenses within 6 months', score: 1 },
      { label: 'Stay untouched — I have an emergency fund', score: 3 },
      { label: 'Stay untouched for years — other income covers me', score: 4 },
    ],
  },
  {
    id: 'experience',
    question: 'Your experience with equity markets:',
    options: [
      { label: 'Never invested in stocks or equity funds', score: 0 },
      { label: 'Only mutual funds / SIPs so far', score: 1 },
      { label: '1–3 years of direct stock investing', score: 2 },
      { label: '3+ years, including at least one crash', score: 3 },
      { label: 'Active investor through multiple cycles', score: 4 },
    ],
  },
  {
    id: 'loss_tolerance',
    question: 'The maximum temporary loss you can accept on the way to long-term returns:',
    options: [
      { label: 'Under 5% — capital safety first', score: 0 },
      { label: 'Up to 10%', score: 1 },
      { label: 'Up to 20%', score: 2 },
      { label: 'Up to 35%', score: 3 },
      { label: '50%+ — I only care about the end result', score: 4 },
    ],
  },
];

export const MAX_RISK_RAW = RISK_QUESTIONS.reduce(
  (sum, q) => sum + Math.max(...q.options.map((o) => o.score)),
  0,
);

export function riskBandFromScore(score: number): RiskBand {
  if (score < 30) return 'LOW';
  if (score < 55) return 'MEDIUM';
  if (score < 78) return 'AGGRESSIVE';
  return 'VERY_AGGRESSIVE';
}

export const RISK_BAND_LABELS: Record<RiskBand, string> = {
  LOW: 'Conservative',
  MEDIUM: 'Moderate',
  AGGRESSIVE: 'Aggressive',
  VERY_AGGRESSIVE: 'Very Aggressive',
};

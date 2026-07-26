import { z } from 'zod';

/**
 * Zod schema mirroring `AdvisorResponse`. Used to
 *  1) validate/repair raw LLM JSON on the server, and
 *  2) derive the JSON-schema block embedded in prompts.
 */
const ratioItemSchema = z.object({
  name: z.string(),
  value: z.string(),
  read: z.enum(['POSITIVE', 'NEGATIVE', 'NEUTRAL']).catch('NEUTRAL'),
  comment: z.string().catch(''),
});

const allocationItemSchema = z.object({
  label: z.string(),
  pct: z.number().min(0).max(100).catch(0),
  amount: z.number().nullable().catch(null),
  note: z.string().catch(''),
});

const alternativeSchema = z.object({
  symbol: z.string().nullable().catch(null),
  name: z.string(),
  reason: z.string().catch(''),
});

const strArr = z.array(z.string()).catch([]);

export const advisorResponseSchema = z.object({
  executiveSummary: z.string().min(1),
  recommendation: z.object({
    action: z
      .enum(['BUY', 'ACCUMULATE', 'HOLD', 'AVOID', 'SELL', 'DIVERSIFY', 'WAIT', 'INVEST', 'REBALANCE'])
      .catch('HOLD'),
    headline: z.string(),
    details: z.string().catch(''),
  }),
  whyThisFitsYourProfile: strArr,
  marketAndSectorContext: z.string().catch(''),
  fundamentalAnalysis: z.object({
    summary: z.string().catch(''),
    keyRatios: z.array(ratioItemSchema).catch([]),
  }),
  technicalAnalysis: z.object({
    summary: z.string().catch(''),
    signals: strArr,
  }),
  riskAssessment: z.object({
    level: z.enum(['LOW', 'MODERATE', 'ELEVATED', 'HIGH', 'VERY_HIGH']).catch('MODERATE'),
    summary: z.string().catch(''),
  }),
  suggestedAllocation: z.array(allocationItemSchema).catch([]),
  investmentHorizon: z.string().catch(''),
  keyRisks: strArr,
  catalysts: strArr,
  pros: strArr,
  cons: strArr,
  alternatives: z.array(alternativeSchema).catch([]),
  actionItems: strArr,
  confidence: z.number().min(0).max(100).catch(50),
  dataNote: z.string().catch(''),
  disclaimer: z.string().catch(''),
});

export type AdvisorResponseParsed = z.infer<typeof advisorResponseSchema>;

export const askAdvisorSchema = z.object({
  question: z.string().trim().min(3, 'Ask a fuller question').max(2000),
  /** Optional explicit symbols, e.g. ["TCS","INFY"] for comparisons. */
  symbols: z.array(z.string().trim().toUpperCase()).max(6).optional(),
  amount: z.number().min(0).optional(),
});

export const chatMessageSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  sessionId: z.string().uuid().optional(),
});

export const generatePortfolioSchema = z.object({
  amount: z.number().min(1000, 'Minimum ₹1,000').max(1_00_00_00_000),
  monthlySip: z.number().min(0).max(1_00_00_000).default(0),
  riskOverride: z.enum(['LOW', 'MEDIUM', 'AGGRESSIVE', 'VERY_AGGRESSIVE']).optional(),
  horizonOverride: z.enum(['LT_1Y', 'Y1_3', 'Y3_5', 'Y5_10', 'GT_10Y']).optional(),
  goalKey: z.string().optional(),
  name: z.string().trim().max(60).optional(),
});

export const aiStockSummarySchema = z.object({
  verdict: z.enum(['POSITIVE', 'NEUTRAL', 'CAUTIOUS', 'NEGATIVE']).catch('NEUTRAL'),
  summary: z.string(),
  bullCase: strArr,
  bearCase: strArr,
  fitForUser: z.string().catch(''),
  confidence: z.number().min(0).max(100).catch(50),
});

export const dailyInsightSchema = z.object({
  niftySummary: z.string(),
  commentary: z.string(),
  keyTakeaways: strArr,
  watchouts: strArr,
  sectorHighlights: z.array(z.object({ sector: z.string(), note: z.string() })).catch([]),
});

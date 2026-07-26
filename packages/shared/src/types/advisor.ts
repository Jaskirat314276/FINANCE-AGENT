/** Structured AI-advisor response contract (rendered natively by the web app). */

export interface AllocationItem {
  label: string;
  pct: number;
  amount: number | null;
  note: string;
}

export interface RatioItem {
  name: string;
  value: string;
  read: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  comment: string;
}

export interface AlternativeIdea {
  symbol: string | null;
  name: string;
  reason: string;
}

/**
 * The 12-section advisory format. The LLM must return exactly this JSON;
 * it is validated server-side with `advisorResponseSchema` before storage.
 */
export interface AdvisorResponse {
  executiveSummary: string;
  recommendation: {
    action: 'BUY' | 'ACCUMULATE' | 'HOLD' | 'AVOID' | 'SELL' | 'DIVERSIFY' | 'WAIT' | 'INVEST' | 'REBALANCE';
    headline: string;
    details: string;
  };
  whyThisFitsYourProfile: string[];
  marketAndSectorContext: string;
  fundamentalAnalysis: {
    summary: string;
    keyRatios: RatioItem[];
  };
  technicalAnalysis: {
    summary: string;
    signals: string[];
  };
  riskAssessment: {
    level: 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH' | 'VERY_HIGH';
    summary: string;
  };
  suggestedAllocation: AllocationItem[];
  investmentHorizon: string;
  keyRisks: string[];
  catalysts: string[];
  pros: string[];
  cons: string[];
  alternatives: AlternativeIdea[];
  actionItems: string[];
  confidence: number; // 0–100
  dataNote: string; // what live data was used / any gaps — honesty requirement
  disclaimer: string;
}

export interface AdvisorMeta {
  provider: string;
  model: string;
  latencyMs: number;
  symbolsAnalyzed: string[];
  dataAsOf: string;
  demoMode: boolean;
}

export interface AdvisorResult {
  id: string;
  question: string;
  response: AdvisorResponse;
  meta: AdvisorMeta;
  createdAt: string;
}

export interface ChatMessageDto {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Present when the assistant produced a full structured advisory. */
  structured?: AdvisorResponse | null;
  createdAt: string;
}

export interface AiStockSummary {
  symbol: string;
  verdict: 'POSITIVE' | 'NEUTRAL' | 'CAUTIOUS' | 'NEGATIVE';
  summary: string;
  bullCase: string[];
  bearCase: string[];
  fitForUser: string;
  confidence: number;
}

export interface DailyInsight {
  date: string;
  niftySummary: string;
  commentary: string;
  keyTakeaways: string[];
  watchouts: string[];
  sectorHighlights: { sector: string; note: string }[];
}

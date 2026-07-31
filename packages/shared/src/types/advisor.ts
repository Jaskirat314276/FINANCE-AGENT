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

/** One numeric claim the verifier extracted from an advisory and checked. */
export interface VerifiedClaim {
  /** Where in the response it was found, e.g. "keyRatios.P/E" or "executiveSummary". */
  location: string;
  /** Metric name, e.g. "P/E", "ROE", "Allocation sum". */
  label: string;
  /** The numeric value the advisory claimed. */
  claimed: number;
  /** The original text token the number was parsed from. */
  raw: string;
  verdict: 'grounded' | 'contradicts' | 'unverified';
  /** Ground-truth value when the claim maps to a known data point. */
  expected?: number;
  /** Where the ground truth came from, e.g. "TCS.P/E" or "35% of ₹500000". */
  source?: string;
  note?: string;
}

/**
 * Result of the deterministic numeric-fidelity check run over an LLM advisory
 * before it is shown to the user (Phase 1 — the numeric verifier).
 */
export interface AdvisorVerification {
  /** True when no claim contradicts the source data. */
  ok: boolean;
  /** 0–100: share of checkable numeric claims that reconcile with the data. */
  score: number;
  /** How many numeric claims were checkable (excludes "unverified"). */
  checked: number;
  /** How many of those reconciled. */
  grounded: number;
  contradictions: VerifiedClaim[];
  /** All extracted claims (grounded + contradicts + unverified). */
  claims: VerifiedClaim[];
  summary: string;
}

/** A concept card injected into the advisor prompt for grounding (Phase 3). */
export interface KnowledgeCitation {
  /** Prompt tag the model cites, e.g. "K1". */
  tag: string;
  id: string;
  concept: string;
  source: string;
  sourceRef: string;
  /** Retrieval score (cosine or keyword overlap). */
  score: number;
}

/** A phrase in an advisory that violates a financial-advice compliance rule (Phase 4). */
export interface ComplianceFlag {
  /** Rule id, e.g. "no-guaranteed-returns". */
  rule: string;
  /** The offending snippet. */
  match: string;
  /** Field it was found in. */
  location: string;
  severity: 'high' | 'medium';
}

/** Whether an advisory's framework claim is backed by the concept cards (Phase 4). */
export interface FrameworkClaimCheck {
  claim: string;
  verdict: 'supported' | 'unsupported' | 'contradicts';
  /** The [K#] card that supports it, if any. */
  cardTag: string | null;
  note: string;
}

/** Phase 4 review — deterministic compliance scan + (opt-in) framework grounding. */
export interface AdvisorFrameworkReview {
  /** True when there are no high-severity compliance flags. */
  ok: boolean;
  compliance: ComplianceFlag[];
  claimChecks: FrameworkClaimCheck[];
  summary: string;
}

export interface AdvisorMeta {
  provider: string;
  model: string;
  latencyMs: number;
  symbolsAnalyzed: string[];
  dataAsOf: string;
  demoMode: boolean;
  /** Numeric-fidelity verification report (present when an LLM answer was produced). */
  verification?: AdvisorVerification;
  /** Concept cards from the knowledge base injected for grounding (Phase 3). */
  knowledge?: KnowledgeCitation[];
  /** Compliance + framework-grounding review (Phase 4). */
  framework?: AdvisorFrameworkReview;
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

import type { AdvisorMeta, AdvisorResponse } from '@seeker/shared';

/**
 * Phase 5 — the eval harness contract.
 *
 * An eval case is a question plus optional expectations; the runner drives an
 * `advise` function and scores the result using the SAME guardrails the
 * pipeline uses (numeric verifier + compliance scan, read from meta). This is
 * how every later change is measured for regressions.
 */

export interface EvalCase {
  id: string;
  question: string;
  symbols?: string[];
  amount?: number;
  expect?: {
    numericOk?: boolean;
    complianceOk?: boolean;
    minConfidence?: number;
    action?: string;
  };
}

export interface EvalScore {
  numericOk: boolean;
  numericScore: number;
  complianceOk: boolean;
  complianceFlags: number;
}

export interface EvalOutcome {
  id: string;
  passed: boolean;
  score: EvalScore;
  failures: string[];
}

/** What the runner needs back from an advisory (the shape `ask()` returns). */
export interface AdvisedResult {
  response: AdvisorResponse;
  meta: AdvisorMeta;
}

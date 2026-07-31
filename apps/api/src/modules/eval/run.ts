import type { AdvisedResult, EvalCase, EvalOutcome, EvalScore } from './types';

/**
 * Score an advisory from the guardrail reports the pipeline already produced
 * (meta.verification + meta.framework). In demo mode (no LLM) there are no
 * reports — the deterministic engine is correct by construction, so treat as ok.
 *
 * TODO(phase5): add an INDEPENDENT re-score (re-run verifyNumbers + scanCompliance
 * against reconstructed ground truth) so the eval doesn't only trust the
 * pipeline's own guards. Needs ask() to expose the ground-truth it used.
 */
export function scoreFromResult(result: AdvisedResult): EvalScore {
  const v = result.meta.verification;
  const fw = result.meta.framework;
  return {
    numericOk: v ? v.ok : true,
    numericScore: v ? v.score : 100,
    complianceOk: fw ? fw.ok : true,
    complianceFlags: fw ? fw.compliance.length : 0,
  };
}

export type AdviseFn = (c: EvalCase) => Promise<AdvisedResult>;

export async function runEval(
  cases: EvalCase[],
  advise: AdviseFn,
): Promise<{ outcomes: EvalOutcome[]; passed: number; total: number }> {
  const outcomes: EvalOutcome[] = [];

  for (const c of cases) {
    const failures: string[] = [];
    try {
      const result = await advise(c);
      const score = scoreFromResult(result);
      const e = c.expect ?? {};

      if (e.numericOk !== undefined && score.numericOk !== e.numericOk) failures.push(`numericOk ${score.numericOk} != ${e.numericOk}`);
      if (e.complianceOk !== undefined && score.complianceOk !== e.complianceOk) failures.push(`complianceOk ${score.complianceOk} != ${e.complianceOk}`);
      if (e.minConfidence !== undefined && result.response.confidence < e.minConfidence)
        failures.push(`confidence ${result.response.confidence} < ${e.minConfidence}`);
      if (e.action !== undefined && result.response.recommendation.action !== e.action)
        failures.push(`action ${result.response.recommendation.action} != ${e.action}`);

      outcomes.push({ id: c.id, passed: failures.length === 0, score, failures });
    } catch (err) {
      outcomes.push({
        id: c.id,
        passed: false,
        score: { numericOk: false, numericScore: 0, complianceOk: false, complianceFlags: 0 },
        failures: [`threw: ${err instanceof Error ? err.message : String(err)}`],
      });
    }
  }

  return { outcomes, passed: outcomes.filter((o) => o.passed).length, total: outcomes.length };
}

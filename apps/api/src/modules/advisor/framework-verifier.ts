import type { AdvisorFrameworkReview, AdvisorResponse, FrameworkClaimCheck, RetrievedCard } from '@seeker/shared';
import { z } from 'zod';
import { logger } from '../../lib/logger';
import type { LlmClient } from './llm/types';
import { extractJson } from './llm/types';
import { scanCompliance } from './compliance';

/**
 * Phase 4 — the Framework Verifier (the "docs-read AND verifier" half).
 *
 * Two checks:
 *   1. Compliance scan (deterministic, always on) — prohibited claims.
 *   2. Framework grounding (LLM, OPT-IN via FRAMEWORK_CHECK=on and only when
 *      cards were retrieved) — are the advisory's framework claims supported
 *      by the concept cards it was given?
 *
 * SCAFFOLD STATUS: the compliance half is complete and enforced. The LLM
 * grounding half runs but is intentionally advisory-only (records verdicts in
 * meta.framework; does not yet trigger repair/fallback) and checks only the
 * top-level claims. It becomes meaningful once real cards are ingested.
 *
 * TODO(phase4):
 *   - Extract ALL framework claims (not just executiveSummary + details).
 *   - Let "contradicts" verdicts trigger a repair/fallback like the numeric guard.
 *   - Verify each [K#] citation the model made actually maps to a real card.
 */

const frameworkChecksSchema = z.object({
  checks: z
    .array(
      z.object({
        claim: z.string(),
        verdict: z.enum(['supported', 'unsupported', 'contradicts']).catch('unsupported'),
        cardTag: z.string().nullable().catch(null),
        note: z.string().catch(''),
      }),
    )
    .catch([]),
});

const FRAMEWORK_CHECK_PROMPT = `You are a fact-checker for an investment advisor. You are given PLAYBOOK CARDS (curated principles) and CLAIMS from an advisory.

For each claim, decide whether the playbook SUPPORTS it, does not address it (UNSUPPORTED), or CONTRADICTS it. Judge only against the cards — do not use outside knowledge.

Return a single JSON object:
{ "checks": [ { "claim": string, "verdict": "supported"|"unsupported"|"contradicts", "cardTag": string|null, "note": string } ] }
Set cardTag to the "[K#]" tag of the supporting/contradicting card, or null.`;

async function checkGrounding(llm: LlmClient, res: AdvisorResponse, cards: RetrievedCard[]): Promise<FrameworkClaimCheck[]> {
  const cardsText = cards.map((r, i) => `[K${i + 1}] ${r.card.concept}: ${r.card.definition}`).join('\n');
  const claims = [res.executiveSummary, res.recommendation.details].filter(Boolean);
  const raw = await llm.complete({
    system: FRAMEWORK_CHECK_PROMPT,
    messages: [{ role: 'user', content: `PLAYBOOK CARDS:\n${cardsText}\n\nCLAIMS:\n${claims.map((c) => `- ${c}`).join('\n')}\n\nReturn the JSON verdict.` }],
    jsonMode: true,
    maxTokens: 1200,
    temperature: 0.1,
  });
  const parsed = frameworkChecksSchema.safeParse(JSON.parse(extractJson(raw)));
  return parsed.success ? parsed.data.checks : [];
}

export async function reviewFramework(
  res: AdvisorResponse,
  cards: RetrievedCard[],
  llm: LlmClient | null,
  runLlmCheck: boolean,
): Promise<AdvisorFrameworkReview> {
  const compliance = scanCompliance(res);

  let claimChecks: FrameworkClaimCheck[] = [];
  if (runLlmCheck && llm && cards.length > 0) {
    try {
      claimChecks = await checkGrounding(llm, res, cards);
    } catch (err) {
      logger.warn('framework grounding check failed — compliance only', { error: err instanceof Error ? err.message : String(err) });
    }
  }

  const highFlags = compliance.filter((f) => f.severity === 'high');
  const ok = highFlags.length === 0;
  const summary = ok
    ? compliance.length > 0
      ? `${compliance.length} low-severity compliance note(s); ${claimChecks.length} framework claim(s) checked.`
      : `No compliance issues; ${claimChecks.length} framework claim(s) checked.`
    : `${highFlags.length} prohibited claim(s): ${[...new Set(highFlags.map((f) => f.rule))].join(', ')}.`;

  return { ok, compliance, claimChecks, summary };
}

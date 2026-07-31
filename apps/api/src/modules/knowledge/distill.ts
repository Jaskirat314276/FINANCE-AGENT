import type { DistilledCard } from '@seeker/shared';
import { distilledCardsSchema } from '@seeker/shared';
import { logger } from '../../lib/logger';
import type { LlmClient } from '../advisor/llm/types';
import { extractJson } from '../advisor/llm/types';
import type { MarkdownChunk } from './chunk';

/**
 * Distillation — turn a passage of a book/Varsity module into structured
 * concept cards (not raw text). This is the "distill, don't dump" step:
 * the LLM extracts durable principles, when to apply them, formulas, common
 * mistakes, and India-specific notes. Only what is present in the text — no
 * invention. The advisor later reasons FROM these cards and the framework
 * verifier checks reasoning AGAINST them.
 */

export const DISTILL_SYSTEM_PROMPT = `You are a financial-education editor building a structured knowledge base for an Indian investment advisor.

From the passage the user provides, extract the distinct INVESTING/FINANCE concepts it actually teaches, as concept cards. Do not summarise the passage as a whole — pull out each reusable idea.

Return a SINGLE JSON object (no markdown, no commentary):
{
  "cards": [
    {
      "concept": string,            // short title, e.g. "Position sizing"
      "definition": string,         // 1-3 sentences, plain language
      "whenToApply": string,        // when this matters for an investor's decision
      "formula": string | null,     // a formula or rule-of-thumb if the passage gives one, else null
      "commonMistakes": string[],   // pitfalls the passage warns about (0-4)
      "indiaNote": string | null,   // India/SEBI/NSE/tax specifics if present, else null
      "tags": string[],             // 2-5 lowercase topic tags, e.g. ["valuation","equity"]
      "tier": "evergreen" | "longtail"  // "evergreen" = durable core principle; "longtail" = narrow/specific fact
    }
  ]
}

Rules:
- Extract only what the passage states. Never invent facts, numbers, or India-specific rules that aren't there.
- Prefer a few high-quality cards over many shallow ones. If the passage teaches nothing reusable, return {"cards": []}.
- Keep each field concise. Definitions must stand on their own without the surrounding text.`;

/**
 * Distill one chunk into concept cards.
 * Returns `null` when the call/parse FAILED (retryable — the caller should try
 * again or leave the chunk for the next run), vs `[]` when the model looked at
 * the passage and found nothing reusable (done — mark the chunk complete).
 */
export async function distillChunk(llm: LlmClient, chunk: MarkdownChunk): Promise<DistilledCard[] | null> {
  try {
    const raw = await llm.complete({
      system: DISTILL_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: chunk.text }],
      jsonMode: true,
      maxTokens: 2200,
      temperature: 0.2,
    });
    const parsed = distilledCardsSchema.safeParse(JSON.parse(extractJson(raw)));
    if (!parsed.success) {
      logger.warn('distill: JSON failed validation', { heading: chunk.heading });
      return null;
    }
    return parsed.data.cards;
  } catch (err) {
    logger.warn('distill: LLM call failed', {
      heading: chunk.heading,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** Canonical text used to embed a card (concept + its key fields + tags). */
export function cardEmbeddingText(c: DistilledCard): string {
  return [c.concept, c.definition, c.whenToApply, c.formula ?? '', c.indiaNote ?? '', c.tags.join(' ')]
    .filter(Boolean)
    .join('. ')
    .trim();
}

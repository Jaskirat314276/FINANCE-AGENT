import { z } from 'zod';

/**
 * Zod schemas mirroring the knowledge-base types.
 *  - `distilledCardsSchema` validates raw LLM distillation output (lenient —
 *    coerces partial cards rather than dropping a whole batch).
 *  - `conceptCardSchema` validates a fully-enriched card when loading the store.
 */

export const distilledCardSchema = z.object({
  concept: z.string().min(1),
  definition: z.string().min(1),
  whenToApply: z.string().catch(''),
  formula: z.string().nullable().catch(null),
  commonMistakes: z.array(z.string()).catch([]),
  indiaNote: z.string().nullable().catch(null),
  tags: z.array(z.string()).catch([]),
  tier: z.enum(['evergreen', 'longtail']).catch('longtail'),
});

/** The LLM returns { cards: [...] }. */
export const distilledCardsSchema = z.object({
  cards: z.array(distilledCardSchema).catch([]),
});

export const conceptCardSchema = distilledCardSchema.extend({
  id: z.string(),
  source: z.string(),
  sourceRef: z.string(),
  contentHash: z.string(),
  embedding: z.array(z.number()).nullable().catch(null),
  createdAt: z.string(),
});

export const conceptCardArraySchema = z.array(conceptCardSchema).catch([]);

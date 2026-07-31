/**
 * Knowledge base (Phase 2) — the distilled "concept card" contract.
 *
 * Books and Zerodha Varsity modules are distilled into structured concept
 * cards (not raw chunks): a durable playbook the advisor reasons FROM and the
 * framework-verifier (Phase 4) checks reasoning AGAINST. Kept deliberately
 * small and typed so the same shape flows through distill → embed → store →
 * retrieve.
 */

/** The core fields an LLM extracts from a passage. */
export interface DistilledCard {
  /** Short title, e.g. "Position sizing". */
  concept: string;
  /** 1–3 sentence explanation. */
  definition: string;
  /** When this matters for an investor's decision. */
  whenToApply: string;
  /** A formula or rule-of-thumb, if the concept has one. */
  formula: string | null;
  /** Pitfalls a beginner makes with this concept. */
  commonMistakes: string[];
  /** India/SEBI/NSE/tax-specific note, if relevant. */
  indiaNote: string | null;
  /** Topic tags for filtering (e.g. ["valuation","equity"]). */
  tags: string[];
  /** Durable core principle vs a narrow/specific fact. */
  tier: 'evergreen' | 'longtail';
}

/** A distilled card enriched with provenance, identity, and its embedding. */
export interface ConceptCard extends DistilledCard {
  /** Stable id = hash(source + concept). */
  id: string;
  /** Book/module name, e.g. "Varsity: Technical Analysis". */
  source: string;
  /** Section/heading the card came from. */
  sourceRef: string;
  /** Hash of the card's content — dedupe + change detection. */
  contentHash: string;
  /** Embedding vector (null until embedded). */
  embedding: number[] | null;
  /** ISO timestamp the card was distilled. */
  createdAt: string;
}

/** A card returned from a retrieval query, with its similarity score. */
export interface RetrievedCard {
  card: ConceptCard;
  /** 0–1 cosine similarity (or keyword overlap when no embedder is configured). */
  score: number;
}

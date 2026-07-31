import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { ConceptCard, DistilledCard, RetrievedCard } from '@seeker/shared';
import { conceptCardArraySchema } from '@seeker/shared';
import { env } from '../../config/env';
import { cosineSim } from './embeddings';

/**
 * File-backed concept-card store with in-app cosine retrieval.
 *
 * Rung-0, ₹0, non-destructive: no DB migration, works on the existing plain
 * Postgres image (which lacks pgvector). Fine for a few hundred–thousand
 * cards. The `KnowledgeStore` interface is the seam: a pgvector/Prisma-backed
 * implementation can replace `FileKnowledgeStore` later with no caller changes.
 */

export interface KnowledgeStore {
  load(): Promise<void>;
  all(): ConceptCard[];
  upsert(cards: ConceptCard[]): void;
  save(): Promise<void>;
  /** Semantic search when a query embedding is available. */
  search(queryEmbedding: number[], k?: number, tier?: ConceptCard['tier']): RetrievedCard[];
  /** Offline fallback when no embedder is configured. */
  searchKeyword(query: string, k?: number): RetrievedCard[];
}

const sha = (s: string): string => createHash('sha256').update(s).digest('hex');

export function defaultStorePath(): string {
  return env.KNOWLEDGE_STORE_PATH || resolve(process.cwd(), 'knowledge', 'cards.json');
}

/** Enrich a distilled card with identity, provenance, embedding, and timestamp. */
export function toConceptCard(
  card: DistilledCard,
  source: string,
  sourceRef: string,
  embedding: number[] | null,
  createdAt: string,
): ConceptCard {
  return {
    ...card,
    id: sha(`${source}::${card.concept}`).slice(0, 24),
    source,
    sourceRef,
    contentHash: sha(`${card.definition}|${card.whenToApply}|${card.formula ?? ''}|${card.indiaNote ?? ''}`).slice(0, 24),
    embedding,
    createdAt,
  };
}

export class FileKnowledgeStore implements KnowledgeStore {
  private cards: ConceptCard[] = [];

  constructor(private readonly path: string = defaultStorePath()) {}

  async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this.path, 'utf8');
      this.cards = conceptCardArraySchema.parse(JSON.parse(raw));
    } catch {
      this.cards = [];
    }
  }

  all(): ConceptCard[] {
    return this.cards;
  }

  upsert(cards: ConceptCard[]): void {
    const byId = new Map(this.cards.map((c) => [c.id, c]));
    for (const c of cards) byId.set(c.id, c);
    this.cards = [...byId.values()];
  }

  async save(): Promise<void> {
    await fs.mkdir(dirname(this.path), { recursive: true });
    await fs.writeFile(this.path, JSON.stringify(this.cards, null, 2), 'utf8');
  }

  search(queryEmbedding: number[], k = 5, tier?: ConceptCard['tier']): RetrievedCard[] {
    return this.cards
      .filter((c) => c.embedding && c.embedding.length > 0 && (!tier || c.tier === tier))
      .map((c) => ({ card: c, score: cosineSim(queryEmbedding, c.embedding!) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  searchKeyword(query: string, k = 5): RetrievedCard[] {
    const terms = new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 2),
    );
    if (terms.size === 0) return [];
    return this.cards
      .map((c) => {
        const hay = `${c.concept} ${c.definition} ${c.whenToApply} ${c.tags.join(' ')}`.toLowerCase();
        let hits = 0;
        for (const t of terms) if (hay.includes(t)) hits++;
        return { card: c, score: hits / terms.size };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }
}

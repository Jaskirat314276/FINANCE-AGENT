import type { RetrievedCard } from '@seeker/shared';
import { logger } from '../../lib/logger';
import { getEmbedder } from './embeddings';
import { FileKnowledgeStore, type KnowledgeStore } from './store';

/**
 * Phase 3 retrieval — fetch the concept cards most relevant to a question so
 * the advisor can reason FROM the books/Varsity playbook.
 *
 * Fully non-destructive: if the store is empty (no cards ingested yet) it
 * returns [] and the advisor prompt is unchanged. With an embedder configured
 * it does semantic search; otherwise it falls back to keyword overlap so the
 * pipeline still works offline.
 */

let storePromise: Promise<KnowledgeStore> | null = null;

async function getStore(): Promise<KnowledgeStore> {
  if (!storePromise) {
    const store = new FileKnowledgeStore();
    storePromise = store.load().then(() => store);
  }
  return storePromise;
}

/** Drop the cached store so the next retrieval reloads from disk (after an ingest). */
export function resetKnowledgeStore(): void {
  storePromise = null;
}

const MIN_SEMANTIC_SCORE = 0.25;

export async function retrieveCards(query: string, k = 6): Promise<RetrievedCard[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const store = await getStore();
    if (store.all().length === 0) return []; // nothing ingested yet → advisor prompt unchanged

    const embedder = getEmbedder();
    if (embedder) {
      try {
        const vecs = await embedder.embed([q]);
        const vec = vecs[0];
        if (vec) {
          const hits = store.search(vec, k).filter((h) => h.score >= MIN_SEMANTIC_SCORE);
          if (hits.length > 0) return hits;
        }
      } catch (err) {
        logger.warn('knowledge retrieve: embed failed — falling back to keyword', { error: String(err) });
      }
    }
    return store.searchKeyword(q, k);
  } catch (err) {
    logger.warn('knowledge retrieve failed — skipping playbook', { error: String(err) });
    return [];
  }
}

/**
 * Knowledge-base smoke tests — pure logic, no LLM/embedder/DB required.
 * Covers the deterministic core of Phase 2: chunking, cosine similarity,
 * distillation-schema coercion, and the file store's round-trip + retrieval.
 * Run: npm run test:knowledge -w @seeker/api
 */
import './setup-env';
import assert from 'node:assert';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import type { ConceptCard, DistilledCard } from '@seeker/shared';
import { distilledCardsSchema } from '@seeker/shared';
import { chunkMarkdown } from '../modules/knowledge/chunk';
import { cosineSim } from '../modules/knowledge/embeddings';
import { FileKnowledgeStore, toConceptCard } from '../modules/knowledge/store';
import { knowledgeContext } from '../modules/advisor/context';

async function run(): Promise<void> {
  // 1) Chunker: one chunk per heading, headings preserved.
  const md = `# Alpha\n${'a '.repeat(60)}\n\n# Beta\n${'b '.repeat(60)}\n\n# Gamma\n${'c '.repeat(60)}`;
  const chunks = chunkMarkdown(md, { minChars: 0 });
  assert.equal(chunks.length, 3, `expected 3 chunks, got ${chunks.length}`);
  assert.deepEqual(chunks.map((c) => c.heading), ['Alpha', 'Beta', 'Gamma']);
  assert.ok(chunks[0]!.text.startsWith('# Alpha'), 'chunk text should carry its heading');

  // Chunker splits an over-long section by paragraph.
  const bigBody = Array.from({ length: 6 }, (_, i) => `Para ${i} ${'x '.repeat(120)}`).join('\n\n');
  const big = chunkMarkdown(`# Big\n${bigBody}`, { maxChars: 400, minChars: 0 });
  assert.ok(big.length > 1, `expected the long section to split, got ${big.length}`);
  assert.ok(big.every((c) => c.text.length <= 520), 'no chunk should blow past the limit');

  // 2) Cosine similarity.
  assert.ok(Math.abs(cosineSim([1, 2, 3], [1, 2, 3]) - 1) < 1e-9, 'identical vectors ≈ 1');
  assert.equal(cosineSim([1, 0], [0, 1]), 0, 'orthogonal vectors = 0');
  assert.ok(cosineSim([1, 0], [-1, 0]) < 0, 'opposite vectors < 0');
  assert.equal(cosineSim([0, 0], [1, 1]), 0, 'zero vector = 0');

  // 3) Distillation schema: valid passes, partial is coerced (not dropped).
  const good = distilledCardsSchema.parse({
    cards: [{ concept: 'X', definition: 'D', whenToApply: 'W', formula: null, commonMistakes: ['m'], indiaNote: null, tags: ['t'], tier: 'evergreen' }],
  });
  assert.equal(good.cards.length, 1);
  const coerced = distilledCardsSchema.parse({ cards: [{ concept: 'Y', definition: 'D2' }] });
  assert.equal(coerced.cards[0]!.tier, 'longtail', 'missing tier defaults to longtail');
  assert.deepEqual(coerced.cards[0]!.commonMistakes, [], 'missing arrays default to []');

  // 4) Store round-trip + retrieval (synthetic embeddings — no embedder needed).
  const mk = (concept: string, definition: string, emb: number[]): ConceptCard => {
    const d: DistilledCard = { concept, definition, whenToApply: '', formula: null, commonMistakes: [], indiaNote: null, tags: [concept.toLowerCase()], tier: 'evergreen' };
    return toConceptCard(d, 'TestSource', 'section', emb, '2026-01-01T00:00:00Z');
  };
  const cards = [
    mk('Position sizing', 'cap single stock weight', [1, 0, 0]),
    mk('P/E ratio', 'price over earnings', [0, 1, 0]),
    mk('Emergency fund', 'cash buffer for months', [0, 0, 1]),
  ];
  const path = resolve(tmpdir(), `seeker-knowledge-test-${process.pid}.json`);
  const store = new FileKnowledgeStore(path);
  store.upsert(cards);
  await store.save();

  const reloaded = new FileKnowledgeStore(path);
  await reloaded.load();
  assert.equal(reloaded.all().length, 3, 'store should persist and reload 3 cards');

  const top = reloaded.search([0.9, 0.1, 0], 2);
  assert.equal(top[0]!.card.concept, 'Position sizing', `nearest to [0.9,0.1,0] should be Position sizing, got ${top[0]?.card.concept}`);

  const kw = reloaded.searchKeyword('emergency cash buffer', 1);
  assert.equal(kw[0]!.card.concept, 'Emergency fund', 'keyword search should find Emergency fund');

  reloaded.upsert([mk('Position sizing', 'cap single stock weight', [1, 0, 0])]);
  assert.equal(reloaded.all().length, 3, 'upsert must not duplicate by id');

  await fs.unlink(path).catch(() => undefined);

  // 5) Phase 3 — playbook block + citations from retrieved cards.
  const { block, citations } = knowledgeContext([
    { card: cards[0]!, score: 0.9 },
    { card: cards[1]!, score: 0.7 },
  ]);
  assert.ok(block.includes('ADVISOR PLAYBOOK'), 'playbook block should have a header');
  assert.ok(block.includes('[K1]') && block.includes('[K2]'), 'playbook block should tag cards [K1],[K2]');
  assert.equal(citations.length, 2);
  assert.equal(citations[0]!.tag, 'K1');
  assert.equal(citations[0]!.concept, cards[0]!.concept, 'citation should map to the card');

  console.log('✅ All knowledge tests passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

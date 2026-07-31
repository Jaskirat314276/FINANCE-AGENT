import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { basename, dirname, extname, resolve } from 'node:path';
import type { ConceptCard, DistilledCard } from '@seeker/shared';
import { logger } from '../lib/logger';
import { getLlm } from '../modules/advisor/llm';
import { chunkMarkdown, type MarkdownChunk } from '../modules/knowledge/chunk';
import { cardEmbeddingText, distillChunk } from '../modules/knowledge/distill';
import { getEmbedder } from '../modules/knowledge/embeddings';
import { defaultStorePath, FileKnowledgeStore, toConceptCard } from '../modules/knowledge/store';

/**
 * CLI: distill markdown books/Varsity modules into concept cards.
 *
 *   Single file/dir:  npm run knowledge:ingest -- <file-or-dir> [--source "Name"]
 *   Manifest mode:    npm run knowledge:ingest -- --manifest knowledge/manifest.json [--tier 1] [--limit 50]
 *
 * Hardened for real corpora on free-tier rate limits:
 *   --limit N     stop after distilling N chunks this run (resume later)
 *   --tier N      manifest mode: only sources with tier ≤ N
 *   --delay ms    pause between LLM calls (default 2500ms — stays under Groq free RPM)
 *   --out path    store path (default apps/api/knowledge/cards.json)
 *
 *   RESUME: every processed chunk is recorded (by content hash) in
 *   knowledge/ingest-progress.json; re-running skips completed chunks, so a
 *   crash, rate-limit wall, or --limit never loses work. Failed chunks are NOT
 *   marked done — the next run retries them.
 *   BACKOFF: each chunk gets up to 3 attempts (3s → 12s → 30s waits).
 *   CHECKPOINT: store + progress are saved every 5 chunks.
 */

interface ManifestEntry {
  path: string;
  source: string;
  tier: number;
  enabled: boolean;
  note?: string;
}

interface Manifest {
  notes?: string[];
  sources: ManifestEntry[];
}

interface Progress {
  done: Record<string, { cards: number; at: string }>;
}

const argOf = (flag: string): string | undefined => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const chunkKey = (source: string, chunk: MarkdownChunk): string =>
  createHash('sha256').update(`${source}::${chunk.heading}::${chunk.text}`).digest('hex').slice(0, 24);

async function loadProgress(path: string): Promise<Progress> {
  try {
    const raw = JSON.parse(await fs.readFile(path, 'utf8')) as Progress;
    return raw && typeof raw.done === 'object' ? raw : { done: {} };
  } catch {
    return { done: {} };
  }
}

async function saveProgress(path: string, p: Progress): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.writeFile(path, JSON.stringify(p, null, 2), 'utf8');
}

async function listMarkdown(input: string): Promise<string[]> {
  const stat = await fs.stat(input);
  if (stat.isFile()) return [input];
  const entries = await fs.readdir(input, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    const p = resolve(input, e.name);
    if (e.isDirectory()) files.push(...(await listMarkdown(p)));
    else if (/\.(md|markdown|txt)$/i.test(e.name)) files.push(p);
  }
  return files.sort();
}

const defaultSourceName = (file: string): string => basename(file, extname(file)).replace(/[-_]+/g, ' ');

/** Manifest paths are repo-root-relative; the script runs with CWD=apps/api. */
function resolveManifestPath(p: string): string {
  const fromRepoRoot = resolve(process.cwd(), '..', '..', p);
  return fromRepoRoot;
}

async function buildWorklist(): Promise<Array<{ file: string; source: string }>> {
  const manifestArg = argOf('--manifest');
  const maxTier = Number(argOf('--tier') ?? Infinity);

  if (manifestArg) {
    const manifest = JSON.parse(await fs.readFile(resolve(manifestArg), 'utf8')) as Manifest;
    const picked = manifest.sources
      .filter((s) => s.enabled && s.tier <= maxTier)
      .sort((a, b) => a.tier - b.tier);
    const work: Array<{ file: string; source: string }> = [];
    for (const entry of picked) {
      const full = resolveManifestPath(entry.path);
      try {
        await fs.stat(full);
        work.push({ file: full, source: entry.source });
      } catch {
        logger.warn(`ingest: manifest path missing — skipping`, { path: entry.path });
      }
    }
    return work;
  }

  const input = process.argv[2];
  if (!input || input.startsWith('-')) {
    console.error('Usage: npm run knowledge:ingest -- <file-or-dir> [--source "Name"] [--out p.json]');
    console.error('   or: npm run knowledge:ingest -- --manifest knowledge/manifest.json [--tier N] [--limit N] [--delay ms]');
    process.exit(1);
  }
  const sourceOverride = argOf('--source');
  const files = await listMarkdown(resolve(input));
  return files.map((file) => ({ file, source: sourceOverride || defaultSourceName(file) }));
}

async function main(): Promise<void> {
  const llm = getLlm();
  if (!llm) {
    console.error('No LLM configured — set AI_PROVIDER + a key (Groq or Ollama). Distillation needs a model.');
    process.exit(1);
  }
  const embedder = getEmbedder();
  const storePath = argOf('--out') || defaultStorePath();
  const progressPath = resolve(dirname(storePath), 'ingest-progress.json');
  const limit = Number(argOf('--limit') ?? Infinity);
  const delayMs = Number(argOf('--delay') ?? 2500);

  const store = new FileKnowledgeStore(storePath);
  await store.load();
  const progress = await loadProgress(progressPath);

  const work = await buildWorklist();
  logger.info(
    `ingest: ${work.length} file(s) | llm=${llm.provider}/${llm.model} | embedder=${embedder?.provider ?? 'none (keyword-only)'} | limit=${limit === Infinity ? '∞' : limit} | delay=${delayMs}ms`,
  );

  let distilledThisRun = 0;
  let skipped = 0;
  let failed = 0;
  let cardsAdded = 0;
  let sinceCheckpoint = 0;

  const checkpoint = async (): Promise<void> => {
    await store.save();
    await saveProgress(progressPath, progress);
    sinceCheckpoint = 0;
  };

  outer: for (const { file, source } of work) {
    const text = await fs.readFile(file, 'utf8');
    const chunks = chunkMarkdown(text);
    let fileCards = 0;
    let fileSkipped = 0;

    for (const chunk of chunks) {
      const key = chunkKey(source, chunk);
      if (progress.done[key]) {
        skipped++;
        fileSkipped++;
        continue;
      }
      if (distilledThisRun >= limit) {
        logger.info(`ingest: --limit ${limit} reached — stopping (resume with the same command)`);
        break outer;
      }

      // Up to 3 attempts with growing waits (rate-limit friendly).
      let distilled: DistilledCard[] | null = null;
      for (const wait of [0, 3_000, 12_000, 30_000]) {
        if (wait > 0) {
          logger.warn(`ingest: retrying chunk after ${wait / 1000}s`, { heading: chunk.heading });
          await sleep(wait);
        }
        distilled = await distillChunk(llm, chunk);
        if (distilled !== null) break;
      }
      distilledThisRun++;

      if (distilled === null) {
        failed++; // NOT marked done — next run retries it
        continue;
      }

      const enriched: ConceptCard[] = [];
      for (const d of distilled) {
        let embedding: number[] | null = null;
        if (embedder) {
          try {
            const vecs = await embedder.embed([cardEmbeddingText(d)]);
            embedding = vecs[0] ?? null;
          } catch (err) {
            logger.warn('ingest: embed failed for card (stored without vector)', { concept: d.concept, error: String(err) });
          }
        }
        enriched.push(toConceptCard(d, source, chunk.heading || basename(file), embedding, new Date().toISOString()));
      }
      store.upsert(enriched);
      cardsAdded += enriched.length;
      fileCards += enriched.length;
      progress.done[key] = { cards: enriched.length, at: new Date().toISOString() };

      if (++sinceCheckpoint >= 5) await checkpoint();
      if (delayMs > 0) await sleep(delayMs);
    }

    logger.info(`ingest: ${basename(file)} → ${chunks.length} chunk(s) (${fileSkipped} already done), +${fileCards} card(s)`);
  }

  await checkpoint();
  logger.info(
    `ingest done: distilled ${distilledThisRun} chunk(s) this run (${skipped} skipped as done, ${failed} failed → will retry next run), +${cardsAdded} card(s) → ${storePath} (${store.all().length} total)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

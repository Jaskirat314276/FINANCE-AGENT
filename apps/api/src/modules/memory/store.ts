import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';

/**
 * Phase 5 — per-user memory (the "learns each user over time" layer).
 *
 * File-backed, keyed by userId; read into the advisor/chat prompt so advice
 * gets more tailored across sessions. Non-destructive: empty until facts are
 * written, and the read path returns [] on any error.
 *
 * SCAFFOLD STATUS: the store + read path + manual write API are done.
 * TODO(phase5): the automated WRITE path — after a session, an extractor
 * (small LLM pass) should summarise durable preferences/goals/corrections and
 * call rememberFact(). That extractor is not built yet. Also TODO: swap the
 * file store for a Prisma table when this grows, and scope/redact PII.
 */

export interface UserFact {
  id: string;
  text: string;
  tags: string[];
  createdAt: string;
}

const factSchema = z.object({
  id: z.string(),
  text: z.string(),
  tags: z.array(z.string()).catch([]),
  createdAt: z.string(),
});
const dbSchema = z.record(z.array(factSchema)).catch({});

function storePath(): string {
  return env.MEMORY_STORE_PATH || resolve(process.cwd(), 'knowledge', 'memory.json');
}

let cache: Record<string, UserFact[]> | null = null;

async function load(): Promise<Record<string, UserFact[]>> {
  if (cache) return cache;
  try {
    cache = dbSchema.parse(JSON.parse(await fs.readFile(storePath(), 'utf8')));
  } catch {
    cache = {};
  }
  return cache;
}

async function persist(db: Record<string, UserFact[]>): Promise<void> {
  const p = storePath();
  await fs.mkdir(dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(db, null, 2), 'utf8');
}

/** A user's remembered facts, most recent first. Safe on any error. */
export async function getUserMemory(userId: string, limit = 12): Promise<string[]> {
  try {
    const db = await load();
    return (db[userId] ?? []).slice(-limit).reverse().map((f) => f.text);
  } catch (err) {
    logger.warn('memory read failed', { error: String(err) });
    return [];
  }
}

/** Persist a durable fact about a user (manual API — see the auto-write TODO above). */
export async function rememberFact(userId: string, text: string, tags: string[] = []): Promise<void> {
  const db = await load();
  const list = db[userId] ?? (db[userId] = []);
  const id = createHash('sha256').update(`${userId}:${text}`).digest('hex').slice(0, 16);
  if (list.some((f) => f.id === id)) return; // dedupe identical facts
  list.push({ id, text, tags, createdAt: new Date().toISOString() });
  await persist(db);
}

/** Drop the in-memory cache (tests / after external writes). */
export function resetMemoryCache(): void {
  cache = null;
}

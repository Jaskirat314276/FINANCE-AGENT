/**
 * Two-tier TTL cache: hot in-memory map + `stale` grace so the UI can show
 * last-known market data when every live provider is down.
 */

interface Entry<T> {
  value: T;
  expiresAt: number;
  staleUntil: number;
}

const store = new Map<string, Entry<unknown>>();

export interface CacheOptions {
  /** Fresh TTL in ms. */
  ttlMs: number;
  /** Extra window during which expired data may still be served as stale. */
  staleMs?: number;
}

export function cacheGet<T>(key: string): { value: T; stale: boolean } | null {
  const hit = store.get(key) as Entry<T> | undefined;
  if (!hit) return null;
  const now = Date.now();
  if (now <= hit.expiresAt) return { value: hit.value, stale: false };
  if (now <= hit.staleUntil) return { value: hit.value, stale: true };
  store.delete(key);
  return null;
}

export function cacheSet<T>(key: string, value: T, opts: CacheOptions): void {
  const now = Date.now();
  store.set(key, {
    value,
    expiresAt: now + opts.ttlMs,
    staleUntil: now + opts.ttlMs + (opts.staleMs ?? opts.ttlMs * 10),
  });
}

/**
 * Memoize an async producer. Serves fresh cache, else runs `producer`,
 * else falls back to stale data if the producer throws.
 */
export async function cached<T>(key: string, opts: CacheOptions, producer: () => Promise<T>): Promise<{ value: T; stale: boolean }> {
  const hit = cacheGet<T>(key);
  if (hit && !hit.stale) return hit;
  try {
    const value = await producer();
    cacheSet(key, value, opts);
    return { value, stale: false };
  } catch (err) {
    if (hit) return { value: hit.value, stale: true };
    throw err;
  }
}

export function cacheClear(prefix?: string): void {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) if (key.startsWith(prefix)) store.delete(key);
}

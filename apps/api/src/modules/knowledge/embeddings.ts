import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { postJson } from '../../lib/http';

/**
 * Provider-agnostic embeddings — mirrors the LLM adapter so the knowledge
 * pipeline is model-independent and ₹0-friendly (local Ollama by default).
 * Returns null when no embedder is configured; callers fall back to keyword
 * retrieval so the pipeline still works offline for development.
 */

export interface Embedder {
  readonly provider: string;
  readonly model: string;
  embed(texts: string[]): Promise<number[][]>;
}

/** Cosine similarity of two equal-length vectors (0 when either is zero). */
export function cosineSim(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    const av = a[i]!;
    const bv = b[i]!;
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Local Ollama: one prompt per call, looped. `ollama pull nomic-embed-text` first. */
class OllamaEmbedder implements Embedder {
  readonly provider = 'ollama';
  constructor(
    private readonly baseUrl: string,
    readonly model: string,
  ) {}

  async embed(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    for (const text of texts) {
      const data = await postJson<{ embedding?: number[] }>(
        `${this.baseUrl.replace(/\/$/, '')}/api/embeddings`,
        { model: this.model, prompt: text },
        { timeoutMs: 60_000 },
      );
      if (!data.embedding?.length) throw new Error('ollama: empty embedding');
      out.push(data.embedding);
    }
    return out;
  }
}

/** Any OpenAI-compatible /embeddings endpoint (OpenAI, Together, etc.). */
class OpenAICompatEmbedder implements Embedder {
  readonly provider = 'openai-compatible';
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    readonly model: string,
  ) {}

  async embed(texts: string[]): Promise<number[][]> {
    const data = await postJson<{ data?: Array<{ embedding?: number[] }> }>(
      `${this.baseUrl.replace(/\/$/, '')}/embeddings`,
      { model: this.model, input: texts },
      { headers: { authorization: `Bearer ${this.apiKey}` }, timeoutMs: 60_000 },
    );
    const rows = data.data ?? [];
    if (rows.length !== texts.length) throw new Error('openai-compatible: embedding count mismatch');
    return rows.map((r) => {
      if (!r.embedding?.length) throw new Error('openai-compatible: empty embedding');
      return r.embedding;
    });
  }
}

let cached: Embedder | null | undefined;

export function getEmbedder(): Embedder | null {
  if (cached !== undefined) return cached;
  cached = build();
  if (cached) logger.info(`Embeddings ready: ${cached.provider} (${cached.model})`);
  else logger.warn('No embeddings provider configured — keyword retrieval only');
  return cached;
}

function build(): Embedder | null {
  switch (env.EMBEDDINGS_PROVIDER) {
    case 'ollama':
      return new OllamaEmbedder(env.OLLAMA_BASE_URL, env.EMBEDDINGS_MODEL);
    case 'openai-compatible':
      return env.EMBEDDINGS_BASE_URL
        ? new OpenAICompatEmbedder(env.EMBEDDINGS_BASE_URL, env.EMBEDDINGS_API_KEY || 'none', env.EMBEDDINGS_MODEL)
        : null;
    case 'none':
      return null;
  }
}

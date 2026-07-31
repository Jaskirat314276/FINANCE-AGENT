import { postJson } from '../../lib/http';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';

/**
 * Phase 5 — web search (the "internet half" of the human-like feel).
 *
 * SCAFFOLD STATUS: provider-agnostic interface + one example provider (Tavily)
 * + a context-block renderer. Deliberately **NOT wired into the advisor yet** —
 * always-on web search adds latency and cost and needs relevance gating.
 *
 * TODO(phase5):
 *   - Wire into ask(): detect "current events / latest / news" intent, call
 *     search, add a webContextBlock to the prompt, and let the numeric/compliance
 *     guards treat web claims as unverified (cite, don't assert).
 *   - Add more providers (Brave, SearXNG-self-hosted for ₹0) behind the enum.
 */

export interface WebResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchProvider {
  readonly provider: string;
  search(query: string, k?: number): Promise<WebResult[]>;
}

class TavilyProvider implements WebSearchProvider {
  readonly provider = 'tavily';
  constructor(private readonly apiKey: string) {}

  async search(query: string, k = 5): Promise<WebResult[]> {
    try {
      const data = await postJson<{ results?: Array<{ title?: string; url?: string; content?: string }> }>(
        'https://api.tavily.com/search',
        { api_key: this.apiKey, query, max_results: k },
        { timeoutMs: 15_000 },
      );
      return (data.results ?? []).map((r) => ({
        title: r.title ?? '',
        url: r.url ?? '',
        snippet: (r.content ?? '').slice(0, 300),
      }));
    } catch (err) {
      logger.warn('web search failed', { error: err instanceof Error ? err.message : String(err) });
      return [];
    }
  }
}

let cached: WebSearchProvider | null | undefined;

export function getWebSearch(): WebSearchProvider | null {
  if (cached !== undefined) return cached;
  cached =
    env.WEB_SEARCH_PROVIDER === 'tavily' && env.WEB_SEARCH_API_KEY
      ? new TavilyProvider(env.WEB_SEARCH_API_KEY)
      : null;
  return cached;
}

export function webContextBlock(results: WebResult[]): string {
  return `=== LIVE WEB RESULTS (unverified — cite, do not assert as fact) ===
${results.map((r, i) => `[W${i + 1}] ${r.title} — ${r.snippet} (${r.url})`).join('\n')}`;
}

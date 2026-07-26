/**
 * Provider-agnostic LLM abstraction.
 * One OpenAI-compatible adapter covers Groq, OpenAI, OpenRouter, Together,
 * Ollama etc.; Anthropic and Gemini get native adapters. The advisor always
 * validates output against Zod schemas and retries once with error feedback,
 * so structured responses are provider-independent.
 */

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LlmRequest {
  system: string;
  messages: LlmMessage[];
  /** Hint that the reply must be a single JSON object. */
  jsonMode?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export interface LlmClient {
  readonly provider: string;
  readonly model: string;
  complete(req: LlmRequest): Promise<string>;
}

/** Pulls the first JSON object out of an LLM reply (handles code fences, prose). */
export function extractJson(text: string): string {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence?.[1]) t = fence[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start >= 0 && end > start) return t.slice(start, end + 1);
  return t;
}

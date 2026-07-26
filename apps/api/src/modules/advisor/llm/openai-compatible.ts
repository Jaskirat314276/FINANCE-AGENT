import { postJson } from '../../../lib/http';
import type { LlmClient, LlmRequest } from './types';

/**
 * Adapter for any OpenAI-compatible chat-completions endpoint.
 * Used for Groq (default), OpenAI itself, OpenRouter, Together, Ollama…
 */
export class OpenAICompatibleClient implements LlmClient {
  constructor(
    readonly provider: string,
    private readonly baseUrl: string,
    private readonly apiKey: string,
    readonly model: string,
  ) {}

  async complete(req: LlmRequest): Promise<string> {
    const body: Record<string, unknown> = {
      model: this.model,
      temperature: req.temperature ?? 0.4,
      max_tokens: req.maxTokens ?? 4096,
      messages: [
        { role: 'system', content: req.system },
        ...req.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    };
    if (req.jsonMode) body.response_format = { type: 'json_object' };

    const data = await postJson<{
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    }>(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, body, {
      headers: { authorization: `Bearer ${this.apiKey}` },
      timeoutMs: 90_000,
    });

    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error(`${this.provider}: empty completion${data.error?.message ? ` (${data.error.message})` : ''}`);
    return content;
  }
}

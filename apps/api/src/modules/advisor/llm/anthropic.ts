import { postJson } from '../../../lib/http';
import type { LlmClient, LlmRequest } from './types';

/** Native Anthropic Messages API adapter (no SDK dependency). */
export class AnthropicClient implements LlmClient {
  readonly provider = 'anthropic';

  constructor(
    private readonly apiKey: string,
    readonly model: string,
  ) {}

  async complete(req: LlmRequest): Promise<string> {
    const messages = req.messages.map((m) => ({ role: m.role, content: m.content }));
    // Prefilling "{" reliably forces JSON-only output from Claude.
    if (req.jsonMode && messages[messages.length - 1]?.role === 'user') {
      messages.push({ role: 'assistant', content: '{' });
    }

    const data = await postJson<{
      content?: Array<{ type: string; text?: string }>;
      error?: { message?: string };
    }>(
      'https://api.anthropic.com/v1/messages',
      {
        model: this.model,
        max_tokens: req.maxTokens ?? 4096,
        temperature: req.temperature ?? 0.4,
        system: req.system,
        messages,
      },
      {
        headers: { 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' },
        timeoutMs: 90_000,
      },
    );

    const text = data.content?.find((c) => c.type === 'text')?.text;
    if (text === undefined) throw new Error(`anthropic: empty completion${data.error?.message ? ` (${data.error.message})` : ''}`);
    return req.jsonMode ? `{${text}` : text;
  }
}

import { postJson } from '../../../lib/http';
import type { LlmClient, LlmRequest } from './types';

/** Native Google Gemini adapter using generateContent. */
export class GeminiClient implements LlmClient {
  readonly provider = 'gemini';

  constructor(
    private readonly apiKey: string,
    readonly model: string,
  ) {}

  async complete(req: LlmRequest): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const data = await postJson<{
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      error?: { message?: string };
    }>(
      url,
      {
        systemInstruction: { parts: [{ text: req.system }] },
        contents: req.messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        generationConfig: {
          temperature: req.temperature ?? 0.4,
          maxOutputTokens: req.maxTokens ?? 4096,
          ...(req.jsonMode ? { responseMimeType: 'application/json' } : {}),
        },
      },
      { timeoutMs: 90_000 },
    );
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('');
    if (!text) throw new Error(`gemini: empty completion${data.error?.message ? ` (${data.error.message})` : ''}`);
    return text;
  }
}

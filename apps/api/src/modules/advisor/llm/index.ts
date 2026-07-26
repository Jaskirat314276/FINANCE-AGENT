import { env } from '../../../config/env';
import { logger } from '../../../lib/logger';
import { AnthropicClient } from './anthropic';
import { GeminiClient } from './gemini';
import { OpenAICompatibleClient } from './openai-compatible';
import type { LlmClient } from './types';

let cached: LlmClient | null | undefined;

/**
 * Resolve the configured LLM client, or null when no key is available —
 * callers then fall back to the deterministic demo advisor.
 */
export function getLlm(): LlmClient | null {
  if (cached !== undefined) return cached;
  cached = build();
  if (cached) logger.info(`AI provider ready: ${cached.provider} (${cached.model})`);
  else logger.warn('No AI key configured — structured demo advisor active');
  return cached;
}

function build(): LlmClient | null {
  switch (env.AI_PROVIDER) {
    case 'groq':
      return env.GROQ_API_KEY
        ? new OpenAICompatibleClient('groq', 'https://api.groq.com/openai/v1', env.GROQ_API_KEY, env.GROQ_MODEL)
        : null;
    case 'openai':
      return env.OPENAI_API_KEY
        ? new OpenAICompatibleClient('openai', 'https://api.openai.com/v1', env.OPENAI_API_KEY, env.OPENAI_MODEL)
        : null;
    case 'anthropic':
      return env.ANTHROPIC_API_KEY ? new AnthropicClient(env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL) : null;
    case 'gemini':
      return env.GEMINI_API_KEY ? new GeminiClient(env.GEMINI_API_KEY, env.GEMINI_MODEL) : null;
    case 'openai-compatible':
      return env.OPENAI_COMPAT_BASE_URL
        ? new OpenAICompatibleClient(
            'openai-compatible',
            env.OPENAI_COMPAT_BASE_URL,
            env.OPENAI_COMPAT_API_KEY || 'none',
            env.OPENAI_COMPAT_MODEL || 'default',
          )
        : null;
    case 'mock':
      return null;
  }
}

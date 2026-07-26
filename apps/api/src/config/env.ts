import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().default('postgresql://seeker:seeker@localhost:5432/seeker_ai?schema=public'),

  JWT_ACCESS_SECRET: z.string().default('dev-only-access-secret-change-me'),
  JWT_REFRESH_SECRET: z.string().default('dev-only-refresh-secret-change-me'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),
  GOOGLE_CLIENT_ID: z.string().optional().default(''),

  AI_PROVIDER: z
    .enum(['groq', 'openai', 'anthropic', 'gemini', 'openai-compatible', 'mock'])
    .default('groq'),
  GROQ_API_KEY: z.string().optional().default(''),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-5'),
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),
  OPENAI_COMPAT_BASE_URL: z.string().optional().default(''),
  OPENAI_COMPAT_API_KEY: z.string().optional().default(''),
  OPENAI_COMPAT_MODEL: z.string().optional().default(''),

  MARKET_PROVIDERS: z.string().default('nse,yahoo,mock'),
  ALPHAVANTAGE_API_KEY: z.string().optional().default(''),
  TWELVEDATA_API_KEY: z.string().optional().default(''),
  FINNHUB_API_KEY: z.string().optional().default(''),
  POLYGON_API_KEY: z.string().optional().default(''),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';

/** True when the configured AI provider has a usable key. */
export function aiKeyAvailable(): boolean {
  switch (env.AI_PROVIDER) {
    case 'groq':
      return !!env.GROQ_API_KEY;
    case 'openai':
      return !!env.OPENAI_API_KEY;
    case 'anthropic':
      return !!env.ANTHROPIC_API_KEY;
    case 'gemini':
      return !!env.GEMINI_API_KEY;
    case 'openai-compatible':
      return !!env.OPENAI_COMPAT_BASE_URL;
    case 'mock':
      return true;
  }
}

if (env.NODE_ENV !== 'test') {
  // eslint-disable-next-line no-console
  console.log(
    `⚙️  Seeker AI API — env=${env.NODE_ENV} ai=${env.AI_PROVIDER}${aiKeyAvailable() ? '' : ' (no key → demo advisor)'} markets=[${env.MARKET_PROVIDERS}]`,
  );
}

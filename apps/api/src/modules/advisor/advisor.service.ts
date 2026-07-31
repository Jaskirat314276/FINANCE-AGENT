import type { AdvisorFrameworkReview, AdvisorResponse, AdvisorResult, AdvisorVerification, AiStockSummary, GeneratedPortfolio, RetrievedCard, StockOverview } from '@seeker/shared';
import { advisorResponseSchema, aiStockSummarySchema, SEBI_DISCLAIMER } from '@seeker/shared';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { env } from '../../config/env';
import * as market from '../market/market.service';
import { getProfile } from '../profile/profile.service';
import { generatePortfolio } from '../portfolio/engine';
import { getLlm } from './llm';
import type { LlmClient } from './llm/types';
import { extractJson } from './llm/types';
import { ADVISOR_SYSTEM_PROMPT, compliancePrompt, numericRepairPrompt, repairPrompt, STOCK_SUMMARY_PROMPT } from './prompts';
import { detectAmount, detectSymbols, knowledgeContext, marketBlock, memoryBlock, portfolioBlock, profileBlock, stockBlock } from './context';
import { demoAdvise } from './demo-advisor';
import { verifyNumbers, type GroundTruth } from './verifier';
import { reviewFramework } from './framework-verifier';
import { retrieveCards } from '../knowledge/retrieve';
import { getUserMemory } from '../memory/store';

/**
 * Advisor orchestration:
 *   question → intent detection → parallel data gathering (profile, market,
 *   per-stock overviews, portfolio-engine baseline) → grounded prompt →
 *   LLM JSON → Zod validation (one repair retry) → deterministic fallback.
 * The response the user sees is ALWAYS schema-valid.
 */

export interface AskParams {
  question: string;
  symbols?: string[];
  amount?: number;
}

const PORTFOLIO_INTENT = /portfolio|sip|invest|diversif|allocat|lakh|crore|₹|rupee|deploy|lump|corpus|retire/i;

export async function ask(userId: string, params: AskParams): Promise<AdvisorResult> {
  const started = Date.now();
  const profile = await getProfile(userId);

  const symbols = detectSymbols(params.question, params.symbols ?? []);
  const amount = params.amount ?? detectAmount(params.question);
  const wantsPortfolio = symbols.length === 0 && (amount !== null || PORTFOLIO_INTENT.test(params.question));

  const [snapshot, overviews, portfolio, cards, memoryFacts] = await Promise.all([
    market.getMarketSnapshot(),
    Promise.all(symbols.map((s) => market.getOverview(s).catch(() => null))).then(
      (list) => list.filter((o): o is StockOverview => o !== null),
    ),
    wantsPortfolio
      ? generatePortfolio(profile, {
          amount: amount ?? Math.max(profile.lumpSum, 1_00_000),
          monthlySip: profile.monthlySip,
          riskBand: profile.riskBand,
          riskScore: profile.riskScore,
          horizon: profile.horizon,
        }).catch((err): GeneratedPortfolio | null => {
          logger.warn('portfolio engine failed during advisor call', { error: String(err) });
          return null;
        })
      : Promise.resolve(null),
    // Phase 3 — pull relevant book/Varsity concept cards (empty until ingested).
    retrieveCards(`${params.question} ${symbols.join(' ')}`).catch((): RetrievedCard[] => []),
    // Phase 5 — remembered facts about this user (empty until anything is written).
    getUserMemory(userId).catch((): string[] => []),
  ]);

  const knowledge = cards.length > 0 ? knowledgeContext(cards) : null;

  const blocks = [
    profileBlock(profile),
    ...(memoryFacts.length > 0 ? [memoryBlock(memoryFacts)] : []),
    marketBlock(snapshot),
    ...overviews.map(stockBlock),
    ...(portfolio ? [portfolioBlock(portfolio)] : []),
    ...(knowledge ? [knowledge.block] : []),
  ].join('\n\n');

  const userPrompt = `${blocks}

=== QUESTION ===
${params.question}
${amount !== null ? `(Detected amount: ₹${amount.toLocaleString('en-IN')})` : ''}

Respond with the single JSON object per your instructions. Every claim must trace to the data above.`;

  const llm = getLlm();
  let response: AdvisorResponse | null = null;
  let provider = 'rule-engine';
  let model = 'seeker-deterministic-v1';
  let verification: AdvisorVerification | undefined;
  let framework: AdvisorFrameworkReview | undefined;

  if (llm) {
    provider = llm.provider;
    model = llm.model;
    response = await completeStructured(llm.provider, () =>
      llm.complete({ system: ADVISOR_SYSTEM_PROMPT, messages: [{ role: 'user', content: userPrompt }], jsonMode: true }),
      (raw, err) =>
        llm.complete({
          system: ADVISOR_SYSTEM_PROMPT,
          messages: [
            { role: 'user', content: userPrompt },
            { role: 'assistant', content: raw.slice(0, 6000) },
            { role: 'user', content: repairPrompt(err) },
          ],
          jsonMode: true,
        }),
    );

    // Phase 1 — numeric verifier: every number in the answer must reconcile
    // with the data the model was given. One targeted repair, else fall back.
    if (response) {
      const ground: GroundTruth = { profile, snapshot, overviews, portfolio, amount };
      verification = verifyNumbers(response, ground);
      if (!verification.ok) {
        logger.warn('advisor numeric verification failed — attempting numeric repair', {
          provider: llm.provider,
          contradictions: verification.contradictions.length,
          detail: verification.summary,
        });
        const repaired = await numericRepair(llm, userPrompt, response, verification);
        if (repaired) {
          const recheck = verifyNumbers(repaired, ground);
          response = repaired;
          verification = recheck;
        }
        if (!verification.ok) {
          logger.error('advisor numeric verification failed after repair — falling back to rule engine', {
            provider: llm.provider,
            detail: verification.summary,
          });
          response = null;
          provider = `${llm.provider}→rule-engine (numeric-guard)`;
        }
      }
    }

    // Phase 4 — compliance + framework review. The compliance scan is
    // deterministic and always enforced; the LLM grounding check is opt-in
    // (FRAMEWORK_CHECK=on) and only runs when cards were retrieved.
    if (response) {
      framework = await reviewFramework(response, cards, llm, env.FRAMEWORK_CHECK === 'on');
      if (!framework.ok) {
        logger.warn('advisor compliance flags — attempting rewrite', {
          provider: llm.provider,
          detail: framework.summary,
        });
        const repaired = await complianceRepair(llm, userPrompt, response, framework);
        if (repaired) {
          response = repaired;
          framework = await reviewFramework(response, cards, llm, env.FRAMEWORK_CHECK === 'on');
        }
        if (!framework.ok) {
          logger.error('advisor compliance failed after rewrite — falling back to rule engine', {
            provider: llm.provider,
            detail: framework.summary,
          });
          response = null;
          provider = `${llm.provider}→rule-engine (compliance-guard)`;
        }
      }
    }
  }

  const demoMode = response === null;
  if (!response) {
    response = demoAdvise({ profile, snapshot, overviews, portfolio, question: params.question, amount });
    if (llm && provider === llm.provider) {
      provider = `${llm.provider}→rule-engine-fallback`;
    }
  }

  response.disclaimer = response.disclaimer || SEBI_DISCLAIMER;

  const meta = {
    provider,
    model: demoMode ? 'seeker-deterministic-v1' : model,
    latencyMs: Date.now() - started,
    symbolsAnalyzed: symbols,
    dataAsOf: snapshot.asOf,
    demoMode,
    ...(verification ? { verification } : {}),
    ...(knowledge ? { knowledge: knowledge.citations } : {}),
    ...(framework ? { framework } : {}),
  };

  const saved = await prisma.advisorQuery.create({
    data: {
      userId,
      question: params.question,
      response: response as unknown as Prisma.InputJsonValue,
      meta: meta as unknown as Prisma.InputJsonValue,
    },
  });

  return { id: saved.id, question: params.question, response, meta, createdAt: saved.createdAt.toISOString() };
}

/** Run an LLM call → extract JSON → validate; one repair retry; null on failure. */
async function completeStructured(
  providerId: string,
  first: () => Promise<string>,
  repair: (raw: string, error: string) => Promise<string>,
): Promise<AdvisorResponse | null> {
  let raw = '';
  try {
    raw = await first();
    const parsed = advisorResponseSchema.safeParse(JSON.parse(extractJson(raw)));
    if (parsed.success) return parsed.data;
    const issue = parsed.error.issues
      .slice(0, 4)
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    logger.warn(`advisor JSON failed validation, retrying`, { provider: providerId, issue });
    const repaired = await repair(raw, issue);
    const second = advisorResponseSchema.safeParse(JSON.parse(extractJson(repaired)));
    if (second.success) return second.data;
    logger.error('advisor JSON failed twice — falling back to rule engine', { provider: providerId });
    return null;
  } catch (err) {
    logger.error('LLM call failed — falling back to rule engine', {
      provider: providerId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** One targeted retry that re-sends the flagged numbers for correction. Null on any failure. */
async function numericRepair(
  llm: LlmClient,
  userPrompt: string,
  previous: AdvisorResponse,
  report: AdvisorVerification,
): Promise<AdvisorResponse | null> {
  try {
    const raw = await llm.complete({
      system: ADVISOR_SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: userPrompt },
        { role: 'assistant', content: JSON.stringify(previous).slice(0, 8000) },
        { role: 'user', content: numericRepairPrompt(report.contradictions) },
      ],
      jsonMode: true,
    });
    const parsed = advisorResponseSchema.safeParse(JSON.parse(extractJson(raw)));
    return parsed.success ? parsed.data : null;
  } catch (err) {
    logger.warn('advisor numeric repair call failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** One retry that re-sends the flagged compliance claims for a compliant rewrite. Null on failure. */
async function complianceRepair(
  llm: LlmClient,
  userPrompt: string,
  previous: AdvisorResponse,
  review: AdvisorFrameworkReview,
): Promise<AdvisorResponse | null> {
  try {
    const raw = await llm.complete({
      system: ADVISOR_SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: userPrompt },
        { role: 'assistant', content: JSON.stringify(previous).slice(0, 8000) },
        { role: 'user', content: compliancePrompt(review.compliance) },
      ],
      jsonMode: true,
    });
    const parsed = advisorResponseSchema.safeParse(JSON.parse(extractJson(raw)));
    return parsed.success ? parsed.data : null;
  } catch (err) {
    logger.warn('advisor compliance repair call failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export async function history(userId: string, limit = 20): Promise<AdvisorResult[]> {
  const rows = await prisma.advisorQuery.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    question: r.question,
    response: r.response as unknown as AdvisorResponse,
    meta: r.meta as unknown as AdvisorResult['meta'],
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Per-stock AI summary for the discovery page. */
export async function stockSummary(userId: string, symbol: string): Promise<AiStockSummary> {
  const [profile, overview] = await Promise.all([getProfile(userId), market.getOverview(symbol)]);
  const llm = getLlm();
  if (llm) {
    try {
      const raw = await llm.complete({
        system: STOCK_SUMMARY_PROMPT,
        messages: [
          {
            role: 'user',
            content: `${profileBlock(profile)}\n\n${stockBlock(overview)}\n\nProduce the JSON verdict for ${symbol} for this user.`,
          },
        ],
        jsonMode: true,
        maxTokens: 1200,
      });
      const parsed = aiStockSummarySchema.safeParse(JSON.parse(extractJson(raw)));
      if (parsed.success) return { symbol, ...parsed.data };
    } catch (err) {
      logger.warn('stock summary LLM failed — deterministic fallback', { error: String(err) });
    }
  }
  // Deterministic fallback via the demo advisor's scoring
  const advice = demoAdvise({
    profile,
    snapshot: await market.getMarketSnapshot(),
    overviews: [overview],
    portfolio: null,
    question: `Summary for ${symbol}`,
    amount: null,
  });
  const verdict =
    advice.recommendation.action === 'ACCUMULATE' || advice.recommendation.action === 'BUY'
      ? 'POSITIVE'
      : advice.recommendation.action === 'AVOID' || advice.recommendation.action === 'SELL'
        ? 'NEGATIVE'
        : advice.recommendation.action === 'WAIT'
          ? 'CAUTIOUS'
          : 'NEUTRAL';
  return {
    symbol,
    verdict,
    summary: advice.executiveSummary,
    bullCase: advice.pros.slice(0, 3),
    bearCase: advice.cons.length ? advice.cons.slice(0, 3) : advice.keyRisks.slice(0, 2),
    fitForUser: advice.whyThisFitsYourProfile[advice.whyThisFitsYourProfile.length - 1] ?? '',
    confidence: advice.confidence,
  };
}

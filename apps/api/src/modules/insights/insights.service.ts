import type { DailyInsight } from '@seeker/shared';
import { dailyInsightSchema, SECTOR_LABELS } from '@seeker/shared';
import { cached } from '../../lib/cache';
import { logger } from '../../lib/logger';
import * as market from '../market/market.service';
import { getLlm } from '../advisor/llm';
import { extractJson } from '../advisor/llm/types';
import { DAILY_INSIGHT_PROMPT } from '../advisor/prompts';
import { marketBlock } from '../advisor/context';

/** Daily AI market commentary — cached 30 min, deterministic fallback. */
export async function getDailyInsight(): Promise<DailyInsight> {
  const { value } = await cached('insight:daily', { ttlMs: 30 * 60_000 }, async () => {
    const snapshot = await market.getMarketSnapshot();
    const date = new Date().toISOString().slice(0, 10);
    const llm = getLlm();

    if (llm) {
      try {
        const raw = await llm.complete({
          system: DAILY_INSIGHT_PROMPT,
          messages: [{ role: 'user', content: `${marketBlock(snapshot)}\n\nWrite today's JSON brief.` }],
          jsonMode: true,
          maxTokens: 1400,
        });
        const parsed = dailyInsightSchema.safeParse(JSON.parse(extractJson(raw)));
        if (parsed.success) return { date, ...parsed.data };
      } catch (err) {
        logger.warn('daily insight LLM failed — deterministic fallback', { error: String(err) });
      }
    }

    // Deterministic composition from the snapshot itself
    const nifty = snapshot.indices.find((i) => i.key === 'NIFTY50');
    const bank = snapshot.indices.find((i) => i.key === 'BANKNIFTY');
    const best = snapshot.sectorPerformance[0];
    const worst = snapshot.sectorPerformance[snapshot.sectorPerformance.length - 1];
    const gain = snapshot.topGainers[0];
    const lose = snapshot.topLosers[0];

    const insight: DailyInsight = {
      date,
      niftySummary: nifty
        ? `NIFTY 50 ${nifty.changePct >= 0 ? 'gained' : 'slipped'} ${Math.abs(nifty.changePct).toFixed(2)}% to ${nifty.value.toFixed(0)}${bank ? `, while Bank Nifty moved ${bank.changePct >= 0 ? '+' : ''}${bank.changePct.toFixed(2)}%` : ''}.`
        : 'Index data unavailable today.',
      commentary: `Market breadth is ${snapshot.sentiment.label.toLowerCase().replace('_', ' ')} with a sentiment score of ${snapshot.sentiment.score}. ${best ? `${SECTOR_LABELS[best.sector]} leads (+${best.avgChangePct.toFixed(2)}%)` : ''}${worst && worst !== best ? ` while ${SECTOR_LABELS[worst.sector]} lags (${worst.avgChangePct.toFixed(2)}%)` : ''}. ${gain ? `${gain.symbol} tops the gainers at +${gain.changePct.toFixed(1)}%` : ''}${lose ? `; ${lose.symbol} is the notable loser at ${lose.changePct.toFixed(1)}%` : ''}. For SIP investors, days like this change nothing — systematic plans should continue regardless of the tape.`,
      keyTakeaways: [
        ...snapshot.sentiment.drivers.slice(0, 3),
        'Volatility is the admission fee for equity returns — react to fundamentals, not headlines.',
      ],
      watchouts: [
        'Global cues (US yields, crude) can flip sentiment overnight',
        'Earnings season announcements may cause single-stock swings',
      ],
      sectorHighlights: snapshot.sectorPerformance.slice(0, 3).map((s) => ({
        sector: SECTOR_LABELS[s.sector],
        note: `${s.avgChangePct >= 0 ? '+' : ''}${s.avgChangePct.toFixed(2)}% avg move, ${s.advancers} up / ${s.decliners} down`,
      })),
    };
    return insight;
  });
  return value;
}

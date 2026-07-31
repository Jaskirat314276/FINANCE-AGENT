/**
 * Guard + eval + memory smoke tests — pure logic, no LLM/DB required.
 * Covers Phase 4 (compliance scan, framework review) and Phase 5 (eval
 * scoring/runner, per-user memory store).
 * Run: npm run test:guards -w @seeker/api
 */
import './setup-env';
import assert from 'node:assert';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import type { AdvisorMeta, AdvisorResponse } from '@seeker/shared';
import { env } from '../config/env';
import { scanCompliance } from '../modules/advisor/compliance';
import { reviewFramework } from '../modules/advisor/framework-verifier';
import { memoryBlock } from '../modules/advisor/context';
import { runEval, scoreFromResult, type AdviseFn } from '../modules/eval/run';
import type { EvalCase } from '../modules/eval/types';
import { getUserMemory, rememberFact, resetMemoryCache } from '../modules/memory/store';

const baseResponse = (over: Partial<AdvisorResponse> = {}): AdvisorResponse => ({
  executiveSummary: 'A calm, grounded summary.',
  recommendation: { action: 'HOLD', headline: 'Hold', details: '' },
  whyThisFitsYourProfile: [],
  marketAndSectorContext: '',
  fundamentalAnalysis: { summary: '', keyRatios: [] },
  technicalAnalysis: { summary: '', signals: [] },
  riskAssessment: { level: 'MODERATE', summary: '' },
  suggestedAllocation: [],
  investmentHorizon: '',
  keyRisks: [],
  catalysts: [],
  pros: [],
  cons: [],
  alternatives: [],
  actionItems: [],
  confidence: 60,
  dataNote: '',
  disclaimer: '',
  ...over,
});

async function run(): Promise<void> {
  // 1) Compliance scan — clean passes, prohibited language flags high.
  assert.equal(scanCompliance(baseResponse()).length, 0, 'clean advisory → no flags');
  const flags = scanCompliance(baseResponse({ executiveSummary: 'This gives guaranteed returns and is risk-free.' }));
  assert.ok(flags.some((f) => f.rule === 'no-guaranteed-returns' && f.severity === 'high'), 'should flag guaranteed/risk-free');

  // 2) Framework review (llm=null → compliance-only).
  const clean = await reviewFramework(baseResponse(), [], null, false);
  assert.ok(clean.ok, 'clean advisory → framework ok');
  const bad = await reviewFramework(
    baseResponse({ recommendation: { action: 'BUY', headline: 'Buy', details: 'This is a risk-free trade and you will definitely profit.' } }),
    [],
    null,
    false,
  );
  assert.equal(bad.ok, false, 'prohibited claim → framework not ok');
  assert.ok(bad.compliance.length > 0, 'prohibited claim → compliance flags recorded');

  // 3) Memory block rendering.
  assert.ok(memoryBlock(['prefers large-cap IT']).includes('prefers large-cap IT'), 'memory block renders facts');

  // 4) Eval runner — expectations checked against meta guards.
  const cases: EvalCase[] = [
    { id: 'a', question: 'q', expect: { numericOk: true } },
    { id: 'b', question: 'q', expect: { complianceOk: true, minConfidence: 50 } },
  ];
  const advise: AdviseFn = async (c) => ({
    response: baseResponse({ confidence: 70 }),
    meta: {
      provider: 'stub',
      model: 'stub',
      latencyMs: 1,
      symbolsAnalyzed: [],
      dataAsOf: '',
      demoMode: false,
      ...(c.id === 'a'
        ? { verification: { ok: false, score: 0, checked: 1, grounded: 0, contradictions: [], claims: [], summary: 'x' } }
        : {}),
    } satisfies AdvisorMeta,
  });
  const { outcomes, passed, total } = await runEval(cases, advise);
  assert.equal(total, 2);
  assert.equal(outcomes.find((o) => o.id === 'a')!.passed, false, 'case a expects numericOk true but got false');
  assert.equal(outcomes.find((o) => o.id === 'b')!.passed, true, 'case b passes (no verification → ok, confidence 70)');
  assert.equal(passed, 1);

  // 5) scoreFromResult — demo mode (no guards) counts as ok.
  const demoScore = scoreFromResult({
    response: baseResponse(),
    meta: { provider: 'rule-engine', model: 'x', latencyMs: 1, symbolsAnalyzed: [], dataAsOf: '', demoMode: true },
  });
  assert.ok(demoScore.numericOk && demoScore.complianceOk, 'demo mode scores ok');

  // 6) Per-user memory store round-trip (temp path + dedupe).
  env.MEMORY_STORE_PATH = resolve(tmpdir(), `seeker-mem-test-${process.pid}.json`);
  resetMemoryCache();
  await rememberFact('u1', 'prefers large-cap IT');
  await rememberFact('u1', 'prefers large-cap IT'); // dedupe
  await rememberFact('u1', 'avoids small-caps');
  resetMemoryCache();
  const facts = await getUserMemory('u1');
  assert.deepEqual(facts, ['avoids small-caps', 'prefers large-cap IT'], 'most-recent-first, deduped');
  await fs.unlink(env.MEMORY_STORE_PATH).catch(() => undefined);

  console.log('✅ All guard/eval/memory tests passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

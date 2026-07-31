import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import { ask } from '../modules/advisor/advisor.service';
import { runEval, type AdviseFn } from '../modules/eval/run';
import type { EvalCase } from '../modules/eval/types';

/**
 * CLI: run the advisor eval suite against a seeded user.
 *
 *   npm run eval:advisor -- apps/api/eval/cases.sample.json --user <userId>
 *
 * REQUIRES: the DB running and a real user id (see `prisma/seed.ts`). Scores
 * come from the pipeline's own guards (meta.verification + meta.framework).
 * TODO(phase5): a `--seed` flow that creates a throwaway profile so this runs
 * without a pre-seeded account, and an independent re-score (see run.ts).
 */

function argOf(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const file = process.argv[2];
  const userId = argOf('--user');
  if (!file || file.startsWith('-') || !userId) {
    console.error('Usage: npm run eval:advisor -- <cases.json> --user <seeded-userId>');
    console.error('NOTE: requires the DB running and a real user id (see prisma/seed.ts).');
    process.exit(1);
  }

  const cases = JSON.parse(await fs.readFile(resolve(file), 'utf8')) as EvalCase[];
  const advise: AdviseFn = async (c) => {
    const r = await ask(userId, { question: c.question, symbols: c.symbols, amount: c.amount });
    return { response: r.response, meta: r.meta };
  };

  const { outcomes, passed, total } = await runEval(cases, advise);
  for (const o of outcomes) {
    console.log(
      `[${o.passed ? 'PASS' : 'FAIL'}] ${o.id} — numeric ${o.score.numericScore}/100 ok=${o.score.numericOk}, complianceOk=${o.score.complianceOk}` +
        (o.failures.length ? ` — ${o.failures.join('; ')}` : ''),
    );
  }
  console.log(`\n${passed}/${total} cases passed.`);
  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

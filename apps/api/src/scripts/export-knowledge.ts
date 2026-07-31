import { promises as fs } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { conceptCardArraySchema } from '@seeker/shared';
import { defaultStorePath } from '../modules/knowledge/store';

/**
 * CLI: export a deploy-ready copy of the concept-card store WITHOUT embeddings.
 *
 *   npm run knowledge:export -w @seeker/api
 *
 * Why: embeddings make cards.json tens of MB (too big to commit), and cloud
 * hosts have no Ollama anyway — production runs keyword retrieval, which needs
 * only the card text. The lite file is small, committed to git, and pointed at
 * via KNOWLEDGE_STORE_PATH in production (see render.yaml).
 */
async function main(): Promise<void> {
  const src = defaultStorePath();
  const out = resolve(dirname(src), 'cards-lite.json');
  const cards = conceptCardArraySchema.parse(JSON.parse(await fs.readFile(src, 'utf8')));
  const lite = cards.map((c) => ({ ...c, embedding: null }));
  await fs.writeFile(out, JSON.stringify(lite), 'utf8');
  const kb = (n: number): string => `${Math.round(n / 1024)} KB`;
  const [a, b] = await Promise.all([fs.stat(src), fs.stat(out)]);
  console.log(`exported ${lite.length} cards → ${out} (${kb(b.size)}, from ${kb(a.size)} with embeddings)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

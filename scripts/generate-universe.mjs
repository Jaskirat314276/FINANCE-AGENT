#!/usr/bin/env node
/**
 * Generate the NIFTY-500 stock universe from NSE's official constituent lists.
 *
 *   node scripts/generate-universe.mjs
 *
 * Inputs (committed snapshots; re-download from nsearchives.nseindia.com to refresh):
 *   scripts/data/ind_nifty100list.csv        → mcap LARGE
 *   scripts/data/ind_niftymidcap150list.csv  → mcap MID
 *   scripts/data/ind_niftysmallcap250list.csv→ mcap SMALL
 *
 * Output: packages/shared/src/constants/stocks500.generated.ts
 *   Contains only symbols NOT already in the curated hand-written universe —
 *   curated entries keep their richer metadata (blueChip/dividend/ESG/sector).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// NSE "Industry" → Seeker Sector enum. Banks/pharma get name-based refinement below.
const INDUSTRY_TO_SECTOR = {
  'Automobile and Auto Components': 'AUTO',
  'Capital Goods': 'MANUFACTURING',
  'Chemicals': 'MANUFACTURING',
  'Construction': 'INFRASTRUCTURE',
  'Construction Materials': 'MANUFACTURING',
  'Consumer Durables': 'CONSUMER',
  'Consumer Services': 'CONSUMER',
  'Diversified': 'MANUFACTURING',
  'Fast Moving Consumer Goods': 'FMCG',
  'Financial Services': 'FINANCIAL_SERVICES',
  'Healthcare': 'HEALTHCARE',
  'Information Technology': 'TECHNOLOGY',
  'Media Entertainment & Publication': 'CONSUMER',
  'Metals & Mining': 'METALS',
  'Oil Gas & Consumable Fuels': 'ENERGY',
  'Power': 'ENERGY',
  'Realty': 'INFRASTRUCTURE',
  'Services': 'INFRASTRUCTURE',
  'Telecommunication': 'TELECOM',
  'Textiles': 'MANUFACTURING',
};

const PHARMA_RE = /pharma|drug|laborator|biocon|lifescience|biosciences|remedies|therapeutic/i;
const BANK_RE = /\bbank\b/i;
const DEFENCE_RE = /aeronautics|bharat electronics|bharat dynamics|mazagon|shipyard|garden reach/i;

function refineSector(name, base) {
  if (base === 'FINANCIAL_SERVICES' && BANK_RE.test(name)) return 'BANKING';
  if (base === 'HEALTHCARE' && PHARMA_RE.test(name)) return 'PHARMA';
  if (DEFENCE_RE.test(name)) return 'DEFENCE';
  return base;
}

/** Minimal CSV line parser (handles quoted fields with commas). */
function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') inQ = !inQ;
    else if (ch === ',' && !inQ) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function readList(file, mcap) {
  const text = readFileSync(resolve(root, 'scripts', 'data', file), 'utf8');
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const header = parseCsvLine(lines[0]);
  const iName = header.indexOf('Company Name');
  const iInd = header.indexOf('Industry');
  const iSym = header.indexOf('Symbol');
  return lines.slice(1).map((l) => {
    const c = parseCsvLine(l);
    const industry = c[iInd];
    const sector = INDUSTRY_TO_SECTOR[industry];
    if (!sector) throw new Error(`Unmapped industry "${industry}" (${c[iSym]})`);
    const name = c[iName].replace(/ Ltd\.?$/i, '').replace(/ Limited$/i, '');
    return {
      symbol: c[iSym],
      name,
      sector: refineSector(name, sector),
      mcap,
      blueChip: false,
      dividendPayer: false,
      esgFriendly: false,
      yahooSymbol: `${c[iSym]}.NS`,
    };
  });
}

// Curated symbols (kept in stocks.ts with richer metadata) — excluded here.
const curatedSrc = readFileSync(resolve(root, 'packages/shared/src/constants/stocks.ts'), 'utf8');
const curated = new Set([...curatedSrc.matchAll(/symbol:\s*'([^']+)'/g)].map((m) => m[1]));

const all = [
  ...readList('ind_nifty100list.csv', 'LARGE'),
  ...readList('ind_niftymidcap150list.csv', 'MID'),
  ...readList('ind_niftysmallcap250list.csv', 'SMALL'),
];
const seen = new Set();
const extension = all.filter((s) => {
  if (curated.has(s.symbol) || seen.has(s.symbol)) return false;
  seen.add(s.symbol);
  return true;
});

const rows = extension
  .map(
    (s) =>
      `  { symbol: '${s.symbol}', name: ${JSON.stringify(s.name)}, sector: '${s.sector}', mcap: '${s.mcap}', blueChip: false, dividendPayer: false, esgFriendly: false, yahooSymbol: '${s.yahooSymbol}' },`,
  )
  .join('\n');

const out = `import type { UniverseStock } from '../types/market';

/**
 * GENERATED FILE — do not edit by hand.
 * NIFTY 500 constituents (NSE official lists) minus the curated hand-written
 * universe in stocks.ts. Regenerate: node scripts/generate-universe.mjs
 * These entries power search/quotes/detail/watchlist; the portfolio engine,
 * screener and market snapshot use the curated subset only.
 */
export const NIFTY500_EXTENSION: UniverseStock[] = [
${rows}
];
`;

writeFileSync(resolve(root, 'packages/shared/src/constants/stocks500.generated.ts'), out, 'utf8');
const bySector = {};
for (const s of extension) bySector[s.sector] = (bySector[s.sector] || 0) + 1;
console.log(`generated ${extension.length} extension stocks (curated excluded: ${curated.size})`);
console.log('sectors:', Object.entries(bySector).map(([k, v]) => `${k}:${v}`).join(' '));

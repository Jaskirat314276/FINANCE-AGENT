import type {
  AdvisorResponse,
  AdvisorVerification,
  FinancialProfile,
  GeneratedPortfolio,
  MarketSnapshot,
  StockOverview,
  VerifiedClaim,
} from '@seeker/shared';

/**
 * Phase 1 — the Numeric Verifier.
 *
 * A deterministic (no-LLM) guard that runs after the advisor LLM returns a
 * schema-valid response. It extracts numeric claims from the answer and checks
 * each one against the SAME ground-truth data the model was handed:
 *   - key ratios (P/E, ROE, D/E, RSI…) vs the stock overviews,
 *   - ratios mentioned in prose vs the same overviews,
 *   - suggested-allocation arithmetic (percentages sum to ~100; amounts match
 *     their stated share of the total).
 *
 * Numbers are verified against the structured data + quant engine — NEVER
 * against the knowledge base (that is Phase 4's framework verifier). A claim
 * that contradicts the data is the exact class of bug seen earlier (a stated
 * P/E that didn't reconcile with the live price + EPS).
 */

export interface GroundTruth {
  profile: FinancialProfile;
  snapshot: MarketSnapshot;
  overviews: StockOverview[];
  portfolio: GeneratedPortfolio | null;
  amount: number | null;
}

type FieldGetter = (o: StockOverview) => number | null | undefined;

interface RatioEntry {
  keys: string[];
  get: FieldGetter;
  name: string;
}

/** Canonical ratios we can check, with the normalized label aliases that map to each. */
const RATIO_MAP: RatioEntry[] = [
  { keys: ['pe', 'peratio', 'priceearnings', 'priceearningsratio', 'trailingpe', 'ttmpe'], get: (o) => o.fundamentals.pe, name: 'P/E' },
  { keys: ['forwardpe', 'fwdpe', 'forwardpriceearnings'], get: (o) => o.fundamentals.forwardPe, name: 'Forward P/E' },
  { keys: ['pb', 'pbratio', 'pricebook', 'pricetobook'], get: (o) => o.fundamentals.pb, name: 'P/B' },
  { keys: ['roe', 'returnonequity'], get: (o) => o.fundamentals.roe, name: 'ROE' },
  { keys: ['roce', 'returnoncapitalemployed'], get: (o) => o.fundamentals.roce, name: 'ROCE' },
  { keys: ['de', 'debttoequity', 'debtequity', 'debttoequityratio'], get: (o) => o.fundamentals.debtToEquity, name: 'D/E' },
  { keys: ['eps'], get: (o) => o.fundamentals.eps, name: 'EPS' },
  { keys: ['epsgrowth', 'epsgrowthpct'], get: (o) => o.fundamentals.epsGrowthPct, name: 'EPS growth' },
  { keys: ['dividendyield', 'divyield'], get: (o) => o.fundamentals.dividendYieldPct, name: 'Dividend yield' },
  { keys: ['beta'], get: (o) => o.fundamentals.beta, name: 'Beta' },
  { keys: ['revenuegrowth', 'revgrowth', 'salesgrowth'], get: (o) => o.fundamentals.revenueGrowthPct, name: 'Revenue growth' },
  { keys: ['profitgrowth', 'netprofitgrowth', 'patgrowth'], get: (o) => o.fundamentals.profitGrowthPct, name: 'Profit growth' },
  { keys: ['rsi', 'rsi14', 'relativestrengthindex'], get: (o) => o.technicals.rsi14, name: 'RSI' },
];

const LOOKUP = new Map<string, RatioEntry>();
for (const entry of RATIO_MAP) for (const k of entry.keys) LOOKUP.set(k, entry);

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Lowercase and strip everything but letters/digits so "P/E", "P/E Ratio", "ROE (%)" normalize cleanly. */
function normLabel(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Pull the first signed decimal out of a value like "16.37x", "₹3,200.00", "12.5%". */
function parseLeadingNumber(raw: string): number | null {
  if (raw == null) return null;
  const m = String(raw).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/** Grounded when within max(0.15 absolute, 6% relative) of the expected value. */
function isClose(claimed: number, expected: number): boolean {
  return Math.abs(claimed - expected) <= Math.max(0.15, 0.06 * Math.abs(expected));
}

/** Check a claimed ratio value against every overview that has that field. */
function checkRatio(
  entry: RatioEntry,
  claimed: number,
  overviews: StockOverview[],
): Pick<VerifiedClaim, 'verdict' | 'expected' | 'source'> {
  const candidates = overviews
    .map((o) => ({ sym: o.quote.symbol, val: entry.get(o) }))
    .filter((c): c is { sym: string; val: number } => typeof c.val === 'number' && Number.isFinite(c.val));

  if (candidates.length === 0) return { verdict: 'unverified' };

  let closest = candidates[0]!;
  for (const c of candidates) {
    if (isClose(claimed, c.val)) return { verdict: 'grounded', expected: c.val, source: `${c.sym}.${entry.name}` };
    if (Math.abs(c.val - claimed) < Math.abs(closest.val - claimed)) closest = c;
  }
  return { verdict: 'contradicts', expected: round1(closest.val), source: `${closest.sym}.${entry.name}` };
}

const PROSE_FIELDS = (res: AdvisorResponse): Array<[string, string]> => [
  ['executiveSummary', res.executiveSummary],
  ['recommendation.details', res.recommendation.details],
  ['fundamentalAnalysis.summary', res.fundamentalAnalysis.summary],
  ['technicalAnalysis.summary', res.technicalAnalysis.summary],
  ['marketAndSectorContext', res.marketAndSectorContext],
];

// "P/E of 29", "ROE is 45%", "RSI at 80", "debt-to-equity ratio is 0.2"
const PROSE_RE =
  /\b(p\/e|pe ratio|forward p\/e|roce|roe|d\/e|debt[- ]?to[- ]?equity|rsi|p\/b|beta|dividend yield)\b(?:\s*(?:ratio|of|is|at|around|near|approximately|approx|~|:|=))*\s*(-?\d[\d,]*\.?\d*)/gi;

/**
 * Verify every numeric claim in an advisory against the ground-truth data.
 * Pure and deterministic — safe to run on every LLM answer.
 */
export function verifyNumbers(res: AdvisorResponse, ground: GroundTruth): AdvisorVerification {
  const { overviews } = ground;
  const claims: VerifiedClaim[] = [];

  // Check A — structured key ratios.
  for (const r of res.fundamentalAnalysis.keyRatios) {
    const entry = LOOKUP.get(normLabel(r.name));
    const claimed = parseLeadingNumber(r.value);
    if (!entry || claimed === null) continue; // not a recognized numeric ratio → nothing to verify
    claims.push({
      location: `keyRatios.${r.name}`,
      label: entry.name,
      claimed,
      raw: r.value,
      ...checkRatio(entry, claimed, overviews),
    });
  }

  // Check A' — ratios mentioned in prose. Only record grounded/contradicts (skip "unverified" to stay quiet).
  for (const [loc, text] of PROSE_FIELDS(res)) {
    if (!text) continue;
    PROSE_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = PROSE_RE.exec(text)) !== null) {
      const entry = LOOKUP.get(normLabel(m[1]!));
      const claimed = parseLeadingNumber(m[2]!);
      if (!entry || claimed === null) continue;
      const chk = checkRatio(entry, claimed, overviews);
      if (chk.verdict === 'unverified') continue;
      claims.push({ location: loc, label: entry.name, claimed, raw: m[0].trim(), ...chk });
    }
  }

  // Check B — allocation integrity (internal arithmetic, not vs a data source).
  const alloc = res.suggestedAllocation;
  if (alloc.length > 0) {
    const sum = alloc.reduce((a, x) => a + (Number(x.pct) || 0), 0);
    if (Math.abs(sum - 100) > 2) {
      claims.push({
        location: 'suggestedAllocation.pct',
        label: 'Allocation sum',
        claimed: round1(sum),
        raw: `${round1(sum)}%`,
        verdict: 'contradicts',
        expected: 100,
        source: 'sum(pct) should be 100',
        note: 'Suggested-allocation percentages do not sum to ~100%.',
      });
    }
    const total = ground.portfolio?.amount ?? ground.amount ?? null;
    if (total && total > 0) {
      for (const x of alloc) {
        if (x.amount === null || x.amount === undefined) continue;
        const pct = Number(x.pct) || 0;
        const expected = (pct / 100) * total;
        if (expected <= 0) continue;
        if (Math.abs(Number(x.amount) - expected) > Math.max(total * 0.02, expected * 0.05)) {
          claims.push({
            location: `suggestedAllocation.${x.label}`,
            label: `${x.label} amount`,
            claimed: Number(x.amount),
            raw: String(x.amount),
            verdict: 'contradicts',
            expected: Math.round(expected),
            source: `${pct}% of ₹${total.toLocaleString('en-IN')}`,
            note: 'Allocation amount is inconsistent with its stated percentage of the total.',
          });
        }
      }
    }
  }

  const checkable = claims.filter((c) => c.verdict !== 'unverified');
  const contradictions = claims.filter((c) => c.verdict === 'contradicts');
  const grounded = checkable.filter((c) => c.verdict === 'grounded').length;
  const score = checkable.length === 0 ? 100 : Math.round((grounded / checkable.length) * 100);
  const ok = contradictions.length === 0;

  const summary = ok
    ? `All ${checkable.length} checkable numeric claim(s) reconcile with the source data.`
    : `${contradictions.length} numeric claim(s) contradict the source data: ${contradictions
        .slice(0, 4)
        .map((c) => `${c.label} claimed ${c.claimed}${c.expected !== undefined ? ` vs ${c.expected}` : ''}`)
        .join('; ')}${contradictions.length > 4 ? '; …' : ''}.`;

  return { ok, score, checked: checkable.length, grounded, contradictions, claims, summary };
}

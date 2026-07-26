import type {
  AllocationSlice,
  AssetClass,
  FinancialProfile,
  Fundamentals,
  FundPick,
  GeneratedPortfolio,
  Horizon,
  MonteCarloResult,
  Quote,
  RebalanceRule,
  RiskBand,
  StockPick,
  UniverseStock,
} from '@seeker/shared';
import {
  ASSET_ASSUMPTIONS,
  BASE_ALLOCATION,
  DEFAULT_CROSS_ASSET_CORRELATION,
  DEFAULT_EQUITY_CORRELATION,
  EMERGENCY_FUND_TARGET_MONTHS,
  HORIZON_YEARS,
  STOCK_UNIVERSE,
} from '@seeker/shared';
import * as market from '../market/market.service';

/**
 * Deterministic portfolio construction engine.
 * Pipeline: base allocation by risk band → horizon / safety / preference
 * tilts → normalized slices → scored stock selection (live-or-demo
 * fundamentals) → fund mapping → return/vol estimate → Monte Carlo.
 * The engine is intentionally explainable: every slice and pick carries
 * a human-readable rationale, and the AI layer receives its output as
 * grounding rather than inventing numbers.
 */

export interface EngineParams {
  amount: number;
  monthlySip: number;
  riskBand: RiskBand;
  riskScore: number;
  horizon: Horizon;
  name?: string;
  targetAmount?: number;
}

const EQUITY_CLASSES: AssetClass[] = ['STOCKS_LARGE', 'STOCKS_MID', 'STOCKS_SMALL'];

// ── Allocation ───────────────────────────────────────────────

function baseWeights(band: RiskBand): Map<AssetClass, number> {
  const map = new Map<AssetClass, number>();
  for (const [cls, pct] of Object.entries(BASE_ALLOCATION[band]) as [AssetClass, number][]) {
    map.set(cls, pct);
  }
  return map;
}

function shift(w: Map<AssetClass, number>, from: AssetClass, to: AssetClass, pct: number): number {
  const available = w.get(from) ?? 0;
  const moved = Math.min(available, pct);
  if (moved <= 0) return 0;
  w.set(from, available - moved);
  w.set(to, (w.get(to) ?? 0) + moved);
  return moved;
}

function normalize(w: Map<AssetClass, number>): void {
  let total = 0;
  for (const v of w.values()) total += v;
  if (total <= 0) return;
  for (const [k, v] of w) w.set(k, (v / total) * 100);
}

export function buildAllocation(
  profile: FinancialProfile,
  params: EngineParams,
): { weights: Map<AssetClass, number>; notes: Map<AssetClass, string>; warnings: string[] } {
  const w = baseWeights(params.riskBand);
  const notes = new Map<AssetClass, string>();
  const warnings: string[] = [];
  const years = HORIZON_YEARS[params.horizon];

  // Horizon tilts — equity risk must match time available to recover.
  if (years < 1.5) {
    for (const cls of [...EQUITY_CLASSES, 'EQUITY_MF', 'INDEX_ETF'] as AssetClass[]) {
      shift(w, cls, 'DEBT_MF', (w.get(cls) ?? 0) * 0.7);
    }
    shift(w, 'DEBT_MF', 'CASH', 10);
    warnings.push('Horizon under ~1.5 years: equity exposure was cut sharply — short horizons cannot absorb drawdowns.');
    notes.set('DEBT_MF', 'Primary sleeve for a short horizon — stability over growth');
  } else if (years < 3.5) {
    shift(w, 'STOCKS_SMALL', 'DEBT_MF', w.get('STOCKS_SMALL') ?? 0);
    shift(w, 'STOCKS_MID', 'INDEX_ETF', (w.get('STOCKS_MID') ?? 0) * 0.5);
    notes.set('INDEX_ETF', 'Mid-cap risk trimmed toward index for the 1–3 year window');
  } else if (years >= 10 && (params.riskBand === 'AGGRESSIVE' || params.riskBand === 'VERY_AGGRESSIVE')) {
    shift(w, 'DEBT_MF', 'STOCKS_MID', 3);
    shift(w, 'CASH', 'INDEX_ETF', 1);
    notes.set('STOCKS_MID', 'Long horizon allows a modest extra mid-cap tilt');
  }

  // Safety valve — thin emergency fund keeps more cash inside the plan.
  const emergencyMonths = profile.monthlyExpenses > 0 ? profile.emergencyFund / profile.monthlyExpenses : 0;
  if (emergencyMonths < 3) {
    const moved =
      shift(w, 'STOCKS_SMALL', 'CASH', 4) + shift(w, 'STOCKS_MID', 'CASH', 4) + shift(w, 'STOCKS_LARGE', 'CASH', 2);
    if (moved > 0) {
      warnings.push(
        `Emergency fund covers only ${emergencyMonths.toFixed(1)} months (target ${EMERGENCY_FUND_TARGET_MONTHS}) — ${moved.toFixed(0)}% extra held liquid.`,
      );
      notes.set('CASH', 'Raised because your emergency fund is below 3 months');
    }
  }

  // Preference tilts.
  const prefs = new Set(profile.marketCapPrefs);
  if (prefs.size > 0 && !prefs.has('SMALL_CAP')) {
    shift(w, 'STOCKS_SMALL', prefs.has('MID_CAP') ? 'STOCKS_MID' : 'STOCKS_LARGE', w.get('STOCKS_SMALL') ?? 0);
  }
  if (prefs.size > 0 && !prefs.has('MID_CAP') && !prefs.has('SMALL_CAP')) {
    shift(w, 'STOCKS_MID', 'STOCKS_LARGE', w.get('STOCKS_MID') ?? 0);
    notes.set('STOCKS_LARGE', 'Concentrated in large caps per your preference');
  }
  if (profile.styles.includes('DIVIDEND')) {
    shift(w, 'STOCKS_SMALL', 'STOCKS_LARGE', (w.get('STOCKS_SMALL') ?? 0) * 0.5);
    notes.set('STOCKS_LARGE', (notes.get('STOCKS_LARGE') ?? 'Dividend focus favours established payers') + '');
  }

  normalize(w);
  return { weights: w, notes, warnings };
}

// ── Stock selection ──────────────────────────────────────────

interface ScoredStock {
  stock: UniverseStock;
  score: number;
  quote: Quote;
  fundamentals: Fundamentals;
  reasons: string[];
}

function scoreStock(s: UniverseStock, f: Fundamentals, profile: FinancialProfile): { score: number; reasons: string[] } {
  let score = 50;
  const reasons: string[] = [];

  if (f.roe !== null) {
    if (f.roe >= 25) {
      score += 14;
      reasons.push(`ROE ${f.roe.toFixed(0)}% — excellent capital efficiency`);
    } else if (f.roe >= 15) {
      score += 8;
      reasons.push(`ROE ${f.roe.toFixed(0)}% — healthy`);
    } else if (f.roe < 8) score -= 8;
  }
  if (f.pe !== null && f.profitGrowthPct !== null && f.profitGrowthPct > 0) {
    const peg = f.pe / f.profitGrowthPct;
    if (peg < 1.5) {
      score += 12;
      reasons.push(`PEG ~${peg.toFixed(1)} — growth reasonably priced`);
    } else if (peg > 4) {
      score -= 8;
      reasons.push(`PEG ~${peg.toFixed(1)} — valuation rich vs growth`);
    }
  }
  if (f.debtToEquity !== null) {
    if (f.debtToEquity < 0.3) {
      score += 6;
      reasons.push('Near debt-free balance sheet');
    } else if (f.debtToEquity > 2) score -= 6;
  }
  if (f.profitGrowthPct !== null && f.profitGrowthPct >= 15) {
    score += 8;
    reasons.push(`Profit growth ${f.profitGrowthPct.toFixed(0)}%`);
  }

  // Profile alignment
  if (profile.preferredSectors.includes(s.sector)) {
    score += 10;
    reasons.push('In your preferred sectors');
  }
  if (profile.styles.includes('DIVIDEND') && s.dividendPayer && (f.dividendYieldPct ?? 0) >= 1) {
    score += 8;
    reasons.push(`Dividend yield ${(f.dividendYieldPct ?? 0).toFixed(1)}%`);
  }
  if (profile.styles.includes('ESG') && s.esgFriendly) score += 5;
  if (profile.styles.includes('VALUE') && f.pe !== null && f.pe < 22) score += 6;
  if (profile.styles.includes('GROWTH') && (f.profitGrowthPct ?? 0) > 15) score += 6;
  if (s.blueChip) score += 4;

  return { score, reasons };
}

async function selectStocks(
  profile: FinancialProfile,
  equityBudget: { cls: AssetClass; amount: number }[],
  maxSinglePctOfTotal: number,
  totalAmount: number,
): Promise<StockPick[]> {
  const avoid = new Set(profile.avoidSectors);
  const candidates = STOCK_UNIVERSE.filter((s) => !avoid.has(s.sector));

  const enriched: ScoredStock[] = [];
  for (const s of candidates) {
    try {
      const [quote, fundamentals] = await Promise.all([market.getQuote(s.symbol), market.getFundamentals(s.symbol)]);
      const { score, reasons } = scoreStock(s, fundamentals, profile);
      enriched.push({ stock: s, score, quote, fundamentals, reasons });
    } catch {
      // skip symbols with no data at all
    }
  }

  const byMcap: Record<string, ScoredStock[]> = { LARGE: [], MID: [], SMALL: [] };
  for (const e of enriched) byMcap[e.stock.mcap]!.push(e);
  for (const list of Object.values(byMcap)) list.sort((a, b) => b.score - a.score);

  const picks: StockPick[] = [];
  const sectorCount = new Map<string, number>();
  const maxAmountPerStock = (maxSinglePctOfTotal / 100) * totalAmount;

  for (const sleeve of equityBudget) {
    if (sleeve.amount <= 0) continue;
    const mcap = sleeve.cls === 'STOCKS_LARGE' ? 'LARGE' : sleeve.cls === 'STOCKS_MID' ? 'MID' : 'SMALL';
    const pool = byMcap[mcap]!.filter((e) => !picks.some((p) => p.symbol === e.stock.symbol));
    // position sizing: aim ₹8k–₹75k positions, 2–6 names per sleeve
    const targetCount = Math.max(1, Math.min(6, Math.floor(sleeve.amount / 25_000) + 1));
    const chosen: ScoredStock[] = [];
    for (const cand of pool) {
      if (chosen.length >= targetCount) break;
      const inSector = sectorCount.get(cand.stock.sector) ?? 0;
      if (inSector >= 2) continue; // sector diversification cap
      chosen.push(cand);
      sectorCount.set(cand.stock.sector, inSector + 1);
    }
    if (chosen.length === 0) continue;

    const totalScore = chosen.reduce((a, b) => a + b.score, 0);
    let remaining = sleeve.amount;
    chosen.forEach((c, idx) => {
      let amount = idx === chosen.length - 1 ? remaining : Math.min((c.score / totalScore) * sleeve.amount, maxAmountPerStock);
      amount = Math.min(amount, remaining, maxAmountPerStock);
      remaining -= amount;
      const shares = c.quote.price > 0 ? Math.floor(amount / c.quote.price) : 0;
      picks.push({
        symbol: c.stock.symbol,
        name: c.stock.name,
        sector: c.stock.sector,
        mcap: c.stock.mcap,
        weightPct: totalAmount > 0 ? (amount / totalAmount) * 100 : 0,
        amount: Math.round(amount),
        approxShares: shares,
        price: c.quote.price,
        rationale: c.reasons.slice(0, 3).join(' · ') || 'Liquid, established name for this sleeve',
      });
    });
  }
  return picks.filter((p) => p.amount >= 1000);
}

// ── Funds ────────────────────────────────────────────────────

function selectFunds(profile: FinancialProfile, slices: AllocationSlice[]): FundPick[] {
  const funds: FundPick[] = [];
  const find = (cls: AssetClass) => slices.find((s) => s.assetClass === cls);

  const equityMf = find('EQUITY_MF');
  if (equityMf && equityMf.amount > 0) {
    const unused80c = Math.max(0, 150_000 - profile.used80cAmount);
    if (unused80c > 20_000 && profile.taxSlab !== 'NONE' && profile.taxSlab !== 'S5') {
      const elssAmt = Math.min(equityMf.amount * 0.5, unused80c);
      funds.push({
        name: 'ELSS Tax-saver Fund',
        category: 'Equity — ELSS (80C)',
        pct: equityMf.pct * (elssAmt / equityMf.amount),
        amount: Math.round(elssAmt),
        rationale: `You have ₹${Math.round(unused80c).toLocaleString('en-IN')} of unused 80C — ELSS gives equity growth plus tax deduction (3-yr lock-in).`,
      });
      funds.push({
        name: 'Flexi-cap Equity Fund',
        category: 'Equity — Flexi-cap',
        pct: equityMf.pct * (1 - elssAmt / equityMf.amount),
        amount: Math.round(equityMf.amount - elssAmt),
        rationale: 'Diversified equity exposure with manager flexibility across market caps.',
      });
    } else {
      funds.push({
        name: 'Flexi-cap Equity Fund',
        category: 'Equity — Flexi-cap',
        pct: equityMf.pct,
        amount: Math.round(equityMf.amount),
        rationale: 'Diversified equity exposure with manager flexibility across market caps.',
      });
    }
  }

  const indexEtf = find('INDEX_ETF');
  if (indexEtf && indexEtf.amount > 0) {
    funds.push({
      name: 'Nifty 50 Index Fund / ETF',
      category: 'Index — Large cap',
      pct: indexEtf.pct,
      amount: Math.round(indexEtf.amount),
      rationale: 'Low-cost core exposure to India\'s 50 largest companies.',
    });
  }

  const debt = find('DEBT_MF');
  if (debt && debt.amount > 0) {
    funds.push({
      name: 'Short-duration Debt Fund',
      category: 'Debt — Short duration',
      pct: debt.pct,
      amount: Math.round(debt.amount),
      rationale: 'Stability sleeve — cushions equity drawdowns and funds rebalancing.',
    });
  }

  const gold = find('GOLD');
  if (gold && gold.amount > 0) {
    funds.push({
      name: 'Gold ETF / Sovereign Gold Bond',
      category: 'Gold',
      pct: gold.pct,
      amount: Math.round(gold.amount),
      rationale: 'Inflation & equity-shock hedge; SGBs add ~2.5% interest if held to maturity.',
    });
  }
  return funds;
}

// ── Risk / return estimates ──────────────────────────────────

export function portfolioStats(weights: Map<AssetClass, number>): { cagr: number; vol: number } {
  let cagr = 0;
  const entries = [...weights.entries()].filter(([, pct]) => pct > 0);
  for (const [cls, pct] of entries) cagr += (pct / 100) * ASSET_ASSUMPTIONS[cls].cagr;

  // Correlated two-factor aggregation: equities highly correlated, cross-asset low.
  let variance = 0;
  for (const [ci, pi] of entries) {
    for (const [cj, pj] of entries) {
      const vi = ASSET_ASSUMPTIONS[ci].vol / 100;
      const vj = ASSET_ASSUMPTIONS[cj].vol / 100;
      const wi = pi / 100;
      const wj = pj / 100;
      const bothEquity =
        (EQUITY_CLASSES.includes(ci) || ci === 'EQUITY_MF' || ci === 'INDEX_ETF') &&
        (EQUITY_CLASSES.includes(cj) || cj === 'EQUITY_MF' || cj === 'INDEX_ETF');
      const rho = ci === cj ? 1 : bothEquity ? DEFAULT_EQUITY_CORRELATION : DEFAULT_CROSS_ASSET_CORRELATION;
      variance += wi * wj * vi * vj * rho;
    }
  }
  return { cagr, vol: Math.sqrt(Math.max(variance, 0)) * 100 };
}

// ── Monte Carlo ──────────────────────────────────────────────

/**
 * Monthly GBM simulation of lump sum + SIP contributions.
 * Returns yearly percentile paths so the UI can draw a fan chart.
 */
export function monteCarlo(opts: {
  lumpSum: number;
  monthlySip: number;
  years: number;
  cagrPct: number;
  volPct: number;
  simulations?: number;
  targetAmount?: number;
}): MonteCarloResult {
  const sims = opts.simulations ?? 1000;
  const months = Math.max(12, Math.round(opts.years * 12));
  const years = Math.round(months / 12);
  const mu = Math.log(1 + opts.cagrPct / 100);
  const sigma = opts.volPct / 100;
  const dt = 1 / 12;
  const drift = (mu - 0.5 * sigma * sigma) * dt;
  const diffusion = sigma * Math.sqrt(dt);

  // Deterministic RNG for reproducible fan charts.
  let seed = 42_1997;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const gauss = () => {
    const u1 = Math.max(rand(), 1e-12);
    const u2 = rand();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };

  const yearEnd: number[][] = Array.from({ length: years }, () => new Array<number>(sims));
  for (let s = 0; s < sims; s++) {
    let value = opts.lumpSum;
    for (let m = 1; m <= months; m++) {
      value = value * Math.exp(drift + diffusion * gauss()) + opts.monthlySip;
      if (m % 12 === 0) yearEnd[m / 12 - 1]![s] = value;
    }
  }

  const invested: number[] = [];
  for (let y = 1; y <= years; y++) invested.push(opts.lumpSum + opts.monthlySip * 12 * y);

  const pct = (arr: number[], p: number) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
    return Math.round(sorted[idx]!);
  };

  const percentiles = {
    p10: yearEnd.map((y) => pct(y, 10)),
    p25: yearEnd.map((y) => pct(y, 25)),
    p50: yearEnd.map((y) => pct(y, 50)),
    p75: yearEnd.map((y) => pct(y, 75)),
    p90: yearEnd.map((y) => pct(y, 90)),
  };

  const final = yearEnd[years - 1]!;
  const totalInvested = invested[years - 1]!;
  const probLoss = final.filter((v) => v < totalInvested).length / sims;
  const probTarget =
    opts.targetAmount && opts.targetAmount > 0 ? final.filter((v) => v >= opts.targetAmount!).length / sims : undefined;

  return {
    years,
    simulations: sims,
    expectedCagrPct: Math.round(opts.cagrPct * 10) / 10,
    volatilityPct: Math.round(opts.volPct * 10) / 10,
    percentiles,
    probLoss: Math.round(probLoss * 1000) / 10 / 100,
    probTarget: probTarget !== undefined ? Math.round(probTarget * 1000) / 10 / 100 : undefined,
    invested,
  };
}

// ── Main entry ───────────────────────────────────────────────

export async function generatePortfolio(profile: FinancialProfile, params: EngineParams): Promise<GeneratedPortfolio> {
  const { weights, notes, warnings } = buildAllocation(profile, params);

  const slices: AllocationSlice[] = [...weights.entries()]
    .filter(([, pct]) => pct >= 0.5)
    .map(([cls, pct]) => ({
      assetClass: cls,
      label: ASSET_ASSUMPTIONS[cls].label,
      pct: Math.round(pct * 10) / 10,
      amount: Math.round((pct / 100) * params.amount),
      rationale: notes.get(cls) ?? defaultRationale(cls, params.riskBand),
    }))
    .sort((a, b) => b.pct - a.pct);

  const equityBudget = slices
    .filter((s) => EQUITY_CLASSES.includes(s.assetClass))
    .map((s) => ({ cls: s.assetClass, amount: s.amount }));

  const stocks = await selectStocks(profile, equityBudget, profile.maxSingleStockAllocationPct, params.amount);
  const funds = selectFunds(profile, slices);
  const { cagr, vol } = portfolioStats(weights);

  const years = Math.max(1, Math.round(HORIZON_YEARS[params.horizon]));
  const mc = monteCarlo({
    lumpSum: params.amount,
    monthlySip: params.monthlySip,
    years: Math.max(years, 3),
    cagrPct: cagr,
    volPct: vol,
    targetAmount: params.targetAmount,
  });

  const surplus = profile.monthlyIncome - profile.monthlyExpenses - profile.monthlyEmi;
  if (params.monthlySip > surplus && surplus >= 0) {
    warnings.push(
      `Planned SIP ₹${params.monthlySip.toLocaleString('en-IN')} exceeds your estimated monthly surplus ₹${Math.round(surplus).toLocaleString('en-IN')} — consider starting lower and stepping up annually.`,
    );
  }

  const rebalancing: RebalanceRule = {
    frequency: params.riskBand === 'LOW' ? 'ANNUAL' : params.riskBand === 'MEDIUM' ? 'SEMI_ANNUAL' : 'QUARTERLY',
    driftThresholdPct: 5,
    notes: [
      'Rebalance when any asset class drifts more than 5% from target.',
      'Prefer directing fresh SIPs to underweight classes over selling (avoids capital-gains tax).',
      'Review stock picks against their thesis every quarter; review allocation twice a year.',
    ],
  };

  return {
    name: params.name ?? `${params.riskBand.charAt(0) + params.riskBand.slice(1).toLowerCase().replace('_', ' ')} portfolio`,
    amount: params.amount,
    monthlySip: params.monthlySip,
    riskBand: params.riskBand,
    riskScore: params.riskScore,
    horizon: params.horizon,
    allocation: slices,
    stocks,
    funds,
    expectedCagrPct: Math.round(cagr * 10) / 10,
    volatilityPct: Math.round(vol * 10) / 10,
    monteCarlo: mc,
    rebalancing,
    warnings,
  };
}

function defaultRationale(cls: AssetClass, band: RiskBand): string {
  switch (cls) {
    case 'STOCKS_LARGE':
      return 'Core compounders — stability with equity growth';
    case 'STOCKS_MID':
      return 'Growth kicker with tolerable volatility';
    case 'STOCKS_SMALL':
      return 'High-risk, high-reward sleeve — sized to survive drawdowns';
    case 'EQUITY_MF':
      return 'Professional management + instant diversification';
    case 'DEBT_MF':
      return band === 'LOW' ? 'Primary stability engine of this plan' : 'Ballast — dampens portfolio swings';
    case 'INDEX_ETF':
      return 'Low-cost market exposure that beats most active picks over time';
    case 'GOLD':
      return 'Hedge against inflation and equity shocks';
    case 'CASH':
      return 'Dry powder for corrections + liquidity buffer';
  }
}

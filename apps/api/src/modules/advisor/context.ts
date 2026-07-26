import type { FinancialProfile, GeneratedPortfolio, MarketSnapshot, StockOverview } from '@seeker/shared';
import { formatINR, HORIZON_LABELS, RISK_BAND_LABELS, SECTOR_LABELS, STOCK_UNIVERSE } from '@seeker/shared';

/**
 * Grounding-context builders. Everything the LLM is allowed to "know"
 * about the user and the market is rendered here as compact text blocks —
 * making prompts auditable and keeping token usage predictable.
 */

export function profileBlock(p: FinancialProfile): string {
  const inv = p.existingInvestments;
  const investedTotal = Object.values(inv).reduce((a, b) => a + b, 0);
  const surplus = p.monthlyIncome - p.monthlyExpenses - p.monthlyEmi;
  const emergencyMonths = p.monthlyExpenses > 0 ? (p.emergencyFund / p.monthlyExpenses).toFixed(1) : 'n/a';
  const goals = p.goals
    .map((g) => `${g.label ?? g.type} → ${formatINR(g.targetAmount, { compact: true })} in ${g.targetYears}y (P${g.priority})`)
    .join('; ');

  return `=== USER PROFILE ===
Age ${p.age}, ${p.occupation} in ${p.city}, employment: ${p.employmentType}, dependents: ${p.dependents}
Income: ${formatINR(p.monthlyIncome, { compact: true })}/mo (${p.incomeStability.toLowerCase().replace('_', ' ')}), expected growth ${p.expectedSalaryGrowthPct}%/yr
Expenses: ${formatINR(p.monthlyExpenses, { compact: true })}/mo, EMIs: ${formatINR(p.monthlyEmi, { compact: true })}/mo → surplus ${formatINR(surplus, { compact: true })}/mo
Savings: ${formatINR(p.currentSavings, { compact: true })}; Emergency fund: ${formatINR(p.emergencyFund, { compact: true })} (${emergencyMonths} months of expenses)
Existing investments (total ${formatINR(investedTotal, { compact: true })}): FD ${formatINR(inv.fd, { compact: true })}, MF ${formatINR(inv.mutualFunds, { compact: true })}, stocks ${formatINR(inv.stocks, { compact: true })}, gold ${formatINR(inv.gold, { compact: true })}, crypto ${formatINR(inv.crypto, { compact: true })}, real estate ${formatINR(inv.realEstate, { compact: true })}, PPF ${formatINR(inv.ppf, { compact: true })}, EPF ${formatINR(inv.epf, { compact: true })}
Risk: score ${p.riskScore}/100 → ${RISK_BAND_LABELS[p.riskBand]} band
Horizon: ${HORIZON_LABELS[p.horizon]}
Plan: SIP ${formatINR(p.monthlySip, { compact: true })}/mo, lump sum available ${formatINR(p.lumpSum, { compact: true })}, max single-stock cap ${p.maxSingleStockAllocationPct}%
Styles: ${p.styles.join(', ') || 'none specified'}; Market-cap prefs: ${p.marketCapPrefs.join(', ') || 'no restriction'}
Preferred sectors: ${p.preferredSectors.map((s) => SECTOR_LABELS[s]).join(', ') || 'none'}; Avoid: ${p.avoidSectors.map((s) => SECTOR_LABELS[s]).join(', ') || 'none'}
Tax: slab ${p.taxSlab}, 80C used ${formatINR(p.used80cAmount, { compact: true })}/₹1.5L, capital-gain pref: ${p.capitalGainPref}
Goals: ${goals || 'none defined'}
Financial health score: ${p.financialHealthScore}/100; Investment readiness: ${p.investmentReadinessScore}/100`;
}

export function marketBlock(s: MarketSnapshot): string {
  const indices = s.indices.map((i) => `${i.name} ${i.value.toFixed(0)} (${i.changePct >= 0 ? '+' : ''}${i.changePct.toFixed(2)}%)`).join(' | ');
  const gainers = s.topGainers.map((g) => `${g.symbol} +${g.changePct.toFixed(1)}%`).join(', ');
  const losers = s.topLosers.map((l) => `${l.symbol} ${l.changePct.toFixed(1)}%`).join(', ');
  const sectors = s.sectorPerformance
    .slice(0, 6)
    .map((sp) => `${sp.sector} ${sp.avgChangePct >= 0 ? '+' : ''}${sp.avgChangePct.toFixed(2)}%`)
    .join(', ');
  return `=== MARKET SNAPSHOT (as of ${s.asOf}, source: ${s.source}) ===
Indices: ${indices}
Sentiment: ${s.sentiment.label} (score ${s.sentiment.score}) — ${s.sentiment.drivers.join('; ')}
Sector performance: ${sectors}
Top gainers: ${gainers}
Top losers: ${losers}`;
}

export function stockBlock(o: StockOverview): string {
  const q = o.quote;
  const f = o.fundamentals;
  const t = o.technicals;
  const fmt = (v: number | null, suffix = '') => (v === null || v === undefined ? 'n/a' : `${Number(v).toFixed(2)}${suffix}`);
  const news = o.news.slice(0, 4).map((n) => `- ${n.title} (${n.source})`).join('\n');
  return `=== STOCK: ${q.symbol} — ${q.name} (${o.universe ? SECTOR_LABELS[o.universe.sector] : 'sector n/a'}, ${o.universe?.mcap ?? '?'} cap) ===
Quote [${q.source}${q.stale ? ', STALE' : ''}]: ₹${q.price.toFixed(2)} (${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(2)}% today), prev close ₹${q.previousClose.toFixed(2)}, day ${q.dayLow.toFixed(0)}–${q.dayHigh.toFixed(0)}
Fundamentals [${f.source}]: MCap ${f.marketCap ? formatINR(f.marketCap, { compact: true }) : 'n/a'}, PE ${fmt(f.pe)}, Fwd PE ${fmt(f.forwardPe)}, EPS ₹${fmt(f.eps)}, EPS growth ${fmt(f.epsGrowthPct, '%')}, PB ${fmt(f.pb)}, ROE ${fmt(f.roe, '%')}, ROCE ${fmt(f.roce, '%')}, D/E ${fmt(f.debtToEquity)}, revenue ${f.revenue ? formatINR(f.revenue, { compact: true }) : 'n/a'} (growth ${fmt(f.revenueGrowthPct, '%')}), profit growth ${fmt(f.profitGrowthPct, '%')}, div yield ${fmt(f.dividendYieldPct, '%')}, 52w ${fmt(f.fiftyTwoWeekLow)}–${fmt(f.fiftyTwoWeekHigh)}, beta ${fmt(f.beta)}
Technicals: trend ${t.trend}; RSI(14) ${fmt(t.rsi14)}; MACD ${t.macd ? `${t.macd.line.toFixed(1)}/${t.macd.signal.toFixed(1)} (hist ${t.macd.histogram.toFixed(1)})` : 'n/a'}; SMA20 ${fmt(t.sma20)}, SMA50 ${fmt(t.sma50)}, SMA200 ${fmt(t.sma200)}; support ${fmt(t.support)}, resistance ${fmt(t.resistance)}
Signals: ${t.signals.join('; ') || 'insufficient history'}
Model analyst view: ${o.analystRating.rating ?? 'n/a'}
Recent news:
${news || '- none available'}`;
}

export function portfolioBlock(p: GeneratedPortfolio): string {
  const alloc = p.allocation.map((a) => `${a.label} ${a.pct}% (${formatINR(a.amount, { compact: true })})`).join(', ');
  const stocks = p.stocks.map((s) => `${s.symbol} ${s.weightPct.toFixed(1)}% (${formatINR(s.amount, { compact: true })}) — ${s.rationale}`).join('\n');
  const funds = p.funds.map((f) => `${f.name} ${formatINR(f.amount, { compact: true })}`).join(', ');
  return `=== PORTFOLIO ENGINE OUTPUT (deterministic baseline for ${formatINR(p.amount, { compact: true })}${p.monthlySip ? ` + ${formatINR(p.monthlySip, { compact: true })}/mo SIP` : ''}) ===
Risk band: ${p.riskBand} (score ${p.riskScore}); horizon: ${p.horizon}
Allocation: ${alloc}
Stock picks:
${stocks || '(none — amount routed to funds)'}
Funds: ${funds || 'none'}
Expected CAGR ${p.expectedCagrPct}% | est. volatility ${p.volatilityPct}% | P(loss at horizon) ${(p.monteCarlo.probLoss * 100).toFixed(1)}%
Warnings: ${p.warnings.join(' | ') || 'none'}`;
}

/** Detect stock symbols mentioned in free text (universe names + tickers). */
export function detectSymbols(text: string, explicit: string[] = []): string[] {
  const found = new Set<string>(explicit.map((s) => s.toUpperCase()));
  const upper = ` ${text.toUpperCase()} `;
  const lower = ` ${text.toLowerCase()} `;
  for (const s of STOCK_UNIVERSE) {
    if (found.size >= 4) break;
    if (upper.includes(` ${s.symbol} `) || upper.includes(` ${s.symbol}?`) || upper.includes(` ${s.symbol}.`) || upper.includes(` ${s.symbol},`)) {
      found.add(s.symbol);
      continue;
    }
    const nameParts = s.name.toLowerCase();
    const firstWord = nameParts.split(' ')[0]!;
    if (nameParts.length > 4 && lower.includes(nameParts)) found.add(s.symbol);
    else if (firstWord.length >= 5 && lower.includes(` ${firstWord} `)) found.add(s.symbol);
  }
  // common aliases
  const aliases: Record<string, string> = {
    'hdfc bank': 'HDFCBANK',
    icici: 'ICICIBANK',
    infosys: 'INFY',
    reliance: 'RELIANCE',
    zomato: 'ZOMATO',
    eternal: 'ZOMATO',
    'tata motors': 'TATAMOTORS',
    'l&t': 'LT',
    airtel: 'BHARTIARTL',
    sbi: 'SBIN',
  };
  for (const [alias, symbol] of Object.entries(aliases)) {
    if (lower.includes(alias) && found.size < 4) found.add(symbol);
  }
  return [...found].slice(0, 4);
}

/** Rupee amounts like "₹50,000", "50000 rs", "10 lakh", "1.5 cr". */
export function detectAmount(text: string): number | null {
  const t = text.toLowerCase().replace(/,/g, '');
  const lakh = t.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lac|l\b)/);
  if (lakh?.[1]) return parseFloat(lakh[1]) * 1_00_000;
  const crore = t.match(/(\d+(?:\.\d+)?)\s*(?:crore|cr\b)/);
  if (crore?.[1]) return parseFloat(crore[1]) * 1_00_00_000;
  const k = t.match(/(\d+(?:\.\d+)?)\s*k\b/);
  if (k?.[1]) return parseFloat(k[1]) * 1_000;
  const plain = t.match(/(?:₹|rs\.?\s*|inr\s*)(\d{3,12})/) ?? t.match(/\b(\d{4,12})\b/);
  if (plain?.[1]) return parseFloat(plain[1]);
  return null;
}

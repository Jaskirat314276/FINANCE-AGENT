import type {
  AdvisorResponse,
  FinancialProfile,
  GeneratedPortfolio,
  MarketSnapshot,
  RatioItem,
  StockOverview,
} from '@seeker/shared';
import { formatINR, HORIZON_LABELS, RISK_BAND_LABELS, SEBI_DISCLAIMER, SECTOR_LABELS } from '@seeker/shared';

/**
 * Deterministic structured advisor — powers demo mode (no AI key) and acts
 * as the guaranteed fallback when an LLM reply fails validation twice.
 * It never invents numbers: every figure comes from the engine, live/demo
 * quotes, fundamentals or the user's own profile.
 */

export interface DemoContext {
  profile: FinancialProfile;
  snapshot: MarketSnapshot;
  overviews: StockOverview[];
  portfolio: GeneratedPortfolio | null;
  question: string;
  amount: number | null;
}

export function demoAdvise(ctx: DemoContext): AdvisorResponse {
  if (ctx.overviews.length >= 2) return compareStocks(ctx);
  if (ctx.overviews.length === 1) return singleStock(ctx, ctx.overviews[0]!);
  if (ctx.portfolio) return portfolioAdvice(ctx, ctx.portfolio);
  return generalAdvice(ctx);
}

// ── helpers ──────────────────────────────────────────────────

function ratios(o: StockOverview): RatioItem[] {
  const f = o.fundamentals;
  const items: RatioItem[] = [];
  const push = (name: string, value: number | null, fmt: (v: number) => string, judge: (v: number) => RatioItem['read'], comment: (v: number) => string) => {
    if (value === null) return;
    items.push({ name, value: fmt(value), read: judge(value), comment: comment(value) });
  };
  push('P/E', f.pe, (v) => v.toFixed(1), (v) => (v < 20 ? 'POSITIVE' : v > 60 ? 'NEGATIVE' : 'NEUTRAL'), (v) => (v < 20 ? 'Reasonable valuation' : v > 60 ? 'Expensive — needs high growth to justify' : 'Fair for a quality franchise'));
  push('ROE', f.roe, (v) => `${v.toFixed(1)}%`, (v) => (v >= 18 ? 'POSITIVE' : v < 10 ? 'NEGATIVE' : 'NEUTRAL'), (v) => (v >= 18 ? 'Strong capital efficiency' : v < 10 ? 'Weak returns on equity' : 'Adequate'));
  push('ROCE', f.roce, (v) => `${v.toFixed(1)}%`, (v) => (v >= 18 ? 'POSITIVE' : v < 10 ? 'NEGATIVE' : 'NEUTRAL'), () => 'Return on total capital employed');
  push('Debt/Equity', f.debtToEquity, (v) => v.toFixed(2), (v) => (v < 0.5 ? 'POSITIVE' : v > 1.5 ? 'NEGATIVE' : 'NEUTRAL'), (v) => (v < 0.5 ? 'Comfortable leverage' : v > 1.5 ? 'High leverage — watch interest costs' : 'Manageable'));
  push('EPS growth', f.epsGrowthPct, (v) => `${v.toFixed(0)}%`, (v) => (v >= 12 ? 'POSITIVE' : v < 0 ? 'NEGATIVE' : 'NEUTRAL'), () => 'Trailing earnings momentum');
  push('Dividend yield', f.dividendYieldPct, (v) => `${v.toFixed(2)}%`, (v) => (v >= 2 ? 'POSITIVE' : 'NEUTRAL'), () => 'Cash returned to shareholders');
  return items.slice(0, 6);
}

function stockScore(o: StockOverview): number {
  const f = o.fundamentals;
  let s = 50;
  if (f.roe !== null) s += f.roe >= 20 ? 12 : f.roe >= 12 ? 6 : -6;
  if (f.pe !== null && f.profitGrowthPct !== null && f.profitGrowthPct > 0) {
    const peg = f.pe / f.profitGrowthPct;
    s += peg < 1.5 ? 10 : peg > 4 ? -8 : 2;
  }
  if (f.debtToEquity !== null) s += f.debtToEquity < 0.5 ? 5 : f.debtToEquity > 2 ? -5 : 0;
  s += o.technicals.trend === 'BULLISH' ? 8 : o.technicals.trend === 'BEARISH' ? -8 : 0;
  return s;
}

function fitBullets(p: FinancialProfile, o?: StockOverview): string[] {
  const bullets = [
    `Your risk score is ${p.riskScore}/100 (${RISK_BAND_LABELS[p.riskBand]}), with a ${HORIZON_LABELS[p.horizon]} horizon — sizing below reflects that.`,
    `Monthly surplus ≈ ${formatINR(p.monthlyIncome - p.monthlyExpenses - p.monthlyEmi, { compact: true })} against a planned SIP of ${formatINR(p.monthlySip, { compact: true })}.`,
  ];
  const months = p.monthlyExpenses > 0 ? p.emergencyFund / p.monthlyExpenses : 0;
  bullets.push(
    months >= 6
      ? `Emergency fund covers ${months.toFixed(1)} months — your foundation supports taking equity risk.`
      : `Emergency fund covers only ${months.toFixed(1)} months — keep new equity exposure measured until it reaches 6.`,
  );
  if (o && o.universe) {
    const preferred = p.preferredSectors.includes(o.universe.sector);
    bullets.push(
      preferred
        ? `${o.universe.sector} is one of your preferred sectors.`
        : `${SECTOR_LABELS[o.universe.sector]} is outside your stated sector preferences — treat this as a diversifier.`,
    );
  }
  return bullets;
}

function marketContext(s: MarketSnapshot): string {
  const nifty = s.indices.find((i) => i.key === 'NIFTY50');
  return `${nifty ? `NIFTY 50 at ${nifty.value.toFixed(0)} (${nifty.changePct >= 0 ? '+' : ''}${nifty.changePct.toFixed(2)}% today). ` : ''}Breadth is ${s.sentiment.label.toLowerCase().replace('_', ' ')} (${s.sentiment.score}); ${s.sentiment.drivers.slice(0, 2).join('; ')}. Sector leadership: ${s.sectorPerformance
    .slice(0, 3)
    .map((sp) => `${SECTOR_LABELS[sp.sector]} ${sp.avgChangePct >= 0 ? '+' : ''}${sp.avgChangePct.toFixed(2)}%`)
    .join(', ')}.`;
}

function dataNote(ctx: DemoContext): string {
  const isMock = (s: string) => s.includes('mock');
  const engine = 'figures come from the data providers and portfolio engine, not a language model.';
  const o = ctx.overviews[0];

  // When a stock is in scope, quote and fundamentals can come from different
  // providers (e.g. a live price but sample fundamentals) — report both truthfully.
  if (o) {
    const quoteMock = isMock(o.quote.source);
    const fundMock = isMock(o.fundamentals.source);
    if (quoteMock && fundMock) {
      return `DEMO MODE: indicative sample data — connect a market-data key for live figures. Generated deterministically by Seeker's rule engine; ${engine}`;
    }
    if (quoteMock !== fundMock) {
      const liveSrc = quoteMock ? o.fundamentals.source : o.quote.source;
      const liveWhat = quoteMock ? 'fundamentals' : 'price';
      const sampleWhat = quoteMock
        ? 'the latest price is'
        : 'fundamentals (P/E, ROE, D/E, growth) are';
      return `PARTIAL DATA: live ${liveWhat} via ${liveSrc}, but ${sampleWhat} indicative sample data — add a fundamentals-capable market-data key for fully live analysis. Generated deterministically by Seeker's rule engine; ${engine}`;
    }
    const srcs = o.fundamentals.source === o.quote.source ? o.quote.source : `${o.quote.source} + ${o.fundamentals.source}`;
    return `Live data via ${srcs}. Generated deterministically by Seeker's rule engine (no AI key configured); ${engine}`;
  }

  // No stock in scope (portfolio / general advice): key off the market snapshot.
  const src = ctx.snapshot.source;
  return isMock(src)
    ? `DEMO MODE: indicative sample data — connect a market-data key for live figures. Generated deterministically by Seeker's rule engine; ${engine}`
    : `Live data via ${src}. Generated deterministically by Seeker's rule engine (no AI key configured); ${engine}`;
}

// ── modes ────────────────────────────────────────────────────

function singleStock(ctx: DemoContext, o: StockOverview): AdvisorResponse {
  const p = ctx.profile;
  const score = stockScore(o);
  const q = o.quote;
  const t = o.technicals;
  const smallOrMid = o.universe?.mcap !== 'LARGE';
  const riskMismatch = smallOrMid && (p.riskBand === 'LOW' || p.riskBand === 'MEDIUM');
  const action = riskMismatch ? 'WAIT' : score >= 62 ? 'ACCUMULATE' : score >= 48 ? 'HOLD' : 'AVOID';

  const maxPct = Math.min(p.maxSingleStockAllocationPct, p.riskBand === 'LOW' ? 5 : p.riskBand === 'MEDIUM' ? 8 : 12);
  const amount = ctx.amount ?? Math.min(p.lumpSum || 50_000, 100_000);

  return {
    executiveSummary: `${q.name} trades at ₹${q.price.toFixed(2)} (${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(2)}% today) with a ${t.trend.toLowerCase()} technical setup. Based on its fundamentals${o.fundamentals.roe !== null ? ` (ROE ${o.fundamentals.roe.toFixed(0)}%)` : ''} and your ${RISK_BAND_LABELS[p.riskBand]} profile, the rule engine's verdict is ${action}.${riskMismatch ? ` As a ${o.universe?.mcap.toLowerCase()}-cap it sits above your risk band, so patience is advised.` : ''}`,
    recommendation: {
      action,
      headline:
        action === 'ACCUMULATE'
          ? `Accumulate ${q.symbol} gradually — cap it at ${maxPct}% of your portfolio`
          : action === 'HOLD'
            ? `${q.symbol} is fairly placed — hold / add only on dips`
            : action === 'WAIT'
              ? `${q.symbol} doesn't fit your risk band today — wait or size tiny`
              : `Avoid fresh ${q.symbol} exposure for now`,
      details: `Verdict blends quality (${o.fundamentals.roe !== null ? `ROE ${o.fundamentals.roe.toFixed(0)}%` : 'ROE n/a'}), valuation (${o.fundamentals.pe !== null ? `P/E ${o.fundamentals.pe.toFixed(0)}` : 'P/E n/a'}) and trend (${t.trend}). ${action === 'ACCUMULATE' ? `Stagger entries in 2–3 tranches near support (₹${t.support?.toFixed(0) ?? 'n/a'}) rather than one shot.` : ''}`,
    },
    whyThisFitsYourProfile: fitBullets(p, o),
    marketAndSectorContext: marketContext(ctx.snapshot),
    fundamentalAnalysis: {
      summary: `${q.name}: ${o.fundamentals.roe !== null ? `ROE ${o.fundamentals.roe.toFixed(1)}%` : 'profitability data unavailable'}${o.fundamentals.profitGrowthPct !== null ? `, profit growth ${o.fundamentals.profitGrowthPct.toFixed(0)}%` : ''}${o.fundamentals.debtToEquity !== null ? `, D/E ${o.fundamentals.debtToEquity.toFixed(2)}` : ''}. ${score >= 62 ? 'Quality metrics clear the bar for a core holding.' : score >= 48 ? 'Metrics are adequate but not compelling at this price.' : 'Weak metrics argue against fresh exposure.'}`,
      keyRatios: ratios(o),
    },
    technicalAnalysis: {
      summary: `Trend ${t.trend}. ${t.rsi14 !== null ? `RSI(14) at ${t.rsi14.toFixed(0)}.` : ''} ${t.support !== null && t.resistance !== null ? `Nearest support ₹${t.support.toFixed(0)}, resistance ₹${t.resistance.toFixed(0)}.` : ''}`,
      signals: t.signals,
    },
    riskAssessment: {
      level: smallOrMid ? 'HIGH' : t.trend === 'BEARISH' ? 'ELEVATED' : 'MODERATE',
      summary: `Single-stock risk is always concentrated. ${smallOrMid ? 'Mid/small-caps can draw down 30–50% in corrections.' : 'Large-cap drawdowns are typically shallower but real.'} Position sizing (≤${maxPct}%) is your primary defence.`,
    },
    suggestedAllocation: [
      { label: q.symbol, pct: maxPct, amount: Math.round((amount * maxPct) / 100), note: 'Staggered over 2–3 tranches' },
      { label: 'Diversified equity (index/flexi-cap)', pct: 100 - maxPct - 10, amount: Math.round((amount * (90 - maxPct)) / 100), note: 'Core portfolio around the single-stock bet' },
      { label: 'Cash buffer', pct: 10, amount: Math.round(amount * 0.1), note: 'Dry powder for dips' },
    ],
    investmentHorizon: `${HORIZON_LABELS[p.horizon]} (your stated horizon); quality large-caps reward 3+ year holds`,
    keyRisks: [
      `A ${SECTOR_LABELS[o.universe?.sector ?? 'CONSUMER']} sector downturn would hit this position directly`,
      o.fundamentals.pe !== null && o.fundamentals.pe > 50 ? `Valuation risk: P/E ${o.fundamentals.pe.toFixed(0)} leaves little room for disappointment` : 'Earnings misses can de-rate the stock quickly',
      'Macro shocks (rates, crude, FII outflows) move the whole market regardless of stock quality',
    ],
    catalysts: ['Quarterly results and management guidance', 'Sector flows and index rebalancing', 'Order wins / product cycle news (check the news feed above)'],
    pros: ratios(o).filter((r) => r.read === 'POSITIVE').map((r) => `${r.name} ${r.value} — ${r.comment}`),
    cons: ratios(o).filter((r) => r.read === 'NEGATIVE').map((r) => `${r.name} ${r.value} — ${r.comment}`),
    alternatives: alternativesFor(o),
    actionItems: [
      riskMismatch ? `Skip for now; revisit if it corrects toward support (₹${t.support?.toFixed(0) ?? '—'})` : `Buy tranche 1 of ${formatINR(Math.round((amount * maxPct) / 100 / 2), { compact: true })} at market`,
      `Set a review alert at support ₹${t.support?.toFixed(0) ?? '—'} and resistance ₹${t.resistance?.toFixed(0) ?? '—'}`,
      'Re-check the thesis after the next quarterly result',
    ],
    confidence: Math.min(78, Math.max(40, score)),
    dataNote: dataNote(ctx),
    disclaimer: SEBI_DISCLAIMER,
  };
}

function compareStocks(ctx: DemoContext): AdvisorResponse {
  const [a, b] = [ctx.overviews[0]!, ctx.overviews[1]!];
  const sa = stockScore(a);
  const sb = stockScore(b);
  const winner = sa >= sb ? a : b;
  const loser = sa >= sb ? b : a;
  const base = singleStock(ctx, winner);
  return {
    ...base,
    executiveSummary: `Comparing ${a.quote.symbol} vs ${b.quote.symbol}: the rule engine scores ${winner.quote.symbol} higher (${Math.max(sa, sb)} vs ${Math.min(sa, sb)}) on blended quality, valuation and trend. ${base.executiveSummary}`,
    recommendation: {
      ...base.recommendation,
      headline: `${winner.quote.symbol} edges out ${loser.quote.symbol} for your profile — ${base.recommendation.action.toLowerCase()} with sizing discipline`,
    },
    alternatives: [
      {
        symbol: loser.quote.symbol,
        name: loser.quote.name,
        reason: `The runner-up — still investable${loser.fundamentals.pe !== null ? ` at P/E ${loser.fundamentals.pe.toFixed(0)}` : ''}; splitting the allocation 60/40 between both is a reasonable diversified take`,
      },
      ...base.alternatives.slice(0, 2),
    ],
  };
}

function portfolioAdvice(ctx: DemoContext, pf: GeneratedPortfolio): AdvisorResponse {
  const p = ctx.profile;
  return {
    executiveSummary: `For ${formatINR(pf.amount, { compact: true })}${pf.monthlySip ? ` plus ${formatINR(pf.monthlySip, { compact: true })}/month SIP` : ''}, the engine built a ${RISK_BAND_LABELS[pf.riskBand]} allocation across ${pf.allocation.length} asset classes with ${pf.stocks.length} direct stocks. Expected CAGR ≈ ${pf.expectedCagrPct}% with ~${pf.volatilityPct}% volatility; probability of being below invested capital at horizon ≈ ${(pf.monteCarlo.probLoss * 100).toFixed(0)}%.`,
    recommendation: {
      action: 'INVEST',
      headline: `Deploy in 3 tranches over 4–6 weeks into the allocation below`,
      details: `Lump-sum timing risk is real; tranching smooths entry. Direct stocks total ${pf.stocks.reduce((acc, s) => acc + s.weightPct, 0).toFixed(0)}% — every pick carries its rationale, and no single stock exceeds your ${p.maxSingleStockAllocationPct}% cap.`,
    },
    whyThisFitsYourProfile: [
      ...fitBullets(p),
      `Allocation was tilted for your ${HORIZON_LABELS[p.horizon]} horizon${pf.warnings.length ? ` — with ${pf.warnings.length} safety adjustment(s) applied (see risks)` : ''}.`,
    ],
    marketAndSectorContext: marketContext(ctx.snapshot),
    fundamentalAnalysis: {
      summary: `Stock sleeve quality: ${pf.stocks.slice(0, 4).map((s) => `${s.symbol} (${s.rationale.split('·')[0]?.trim()})`).join('; ')}.`,
      keyRatios: [],
    },
    technicalAnalysis: {
      summary: 'Portfolio construction is strategic, not timing-based; use the tranche plan rather than technical entries.',
      signals: [],
    },
    riskAssessment: {
      level: pf.riskBand === 'LOW' ? 'LOW' : pf.riskBand === 'MEDIUM' ? 'MODERATE' : pf.riskBand === 'AGGRESSIVE' ? 'HIGH' : 'VERY_HIGH',
      summary: `Estimated portfolio volatility ${pf.volatilityPct}%. In a 2008/2020-style crash the equity sleeve could temporarily fall 30–40%; the debt/gold/cash sleeves (${pf.allocation.filter((s) => ['DEBT_MF', 'GOLD', 'CASH'].includes(s.assetClass)).reduce((acc, s) => acc + s.pct, 0).toFixed(0)}%) cushion and fund rebalancing.`,
    },
    suggestedAllocation: pf.allocation.map((s) => ({ label: s.label, pct: s.pct, amount: s.amount, note: s.rationale })),
    investmentHorizon: `${HORIZON_LABELS[p.horizon]}; rebalance ${pf.rebalancing.frequency.toLowerCase().replace('_', '-')}`,
    keyRisks: [...pf.warnings, 'Equity drawdowns of 20–30% are normal within multi-year horizons', 'Assumed CAGRs are planning estimates, not guarantees'],
    catalysts: ['Earnings season surprises', 'RBI rate cycle', 'FII/DII flow reversals'],
    pros: [
      `Diversified across ${pf.allocation.length} asset classes and ${new Set(pf.stocks.map((s) => s.sector)).size} sectors`,
      `Every stock pick carries an explicit rationale`,
      `Monte Carlo median outcome: ${formatINR(pf.monteCarlo.percentiles.p50[pf.monteCarlo.percentiles.p50.length - 1] ?? 0, { compact: true })} at horizon`,
    ],
    cons: [
      'Direct stocks need quarterly monitoring — index/MF sleeves are lower maintenance',
      `~${(pf.monteCarlo.probLoss * 100).toFixed(0)}% of simulations end below invested capital at horizon`,
    ],
    alternatives: [
      { symbol: null, name: '100% index-fund route', reason: 'If monitoring stocks feels heavy, a Nifty50 + flexi-cap SIP achieves ~85% of the outcome with near-zero effort' },
      { symbol: null, name: 'Balanced advantage fund', reason: 'One-fund auto-balancing alternative for a hands-off approach' },
    ],
    actionItems: [
      `Week 1: deploy ${formatINR(Math.round(pf.amount / 3), { compact: true })} into the debt/gold/index sleeves`,
      `Weeks 2–6: two more tranches into the stock sleeve near supports`,
      pf.monthlySip ? `Automate the ${formatINR(pf.monthlySip, { compact: true })} SIP on salary day` : 'Set up SIPs to keep averaging',
      `Calendar a ${pf.rebalancing.frequency.toLowerCase().replace('_', '-')} rebalancing review`,
    ],
    confidence: 72,
    dataNote: dataNote(ctx),
    disclaimer: SEBI_DISCLAIMER,
  };
}

function generalAdvice(ctx: DemoContext): AdvisorResponse {
  const p = ctx.profile;
  const months = p.monthlyExpenses > 0 ? p.emergencyFund / p.monthlyExpenses : 0;
  const surplus = p.monthlyIncome - p.monthlyExpenses - p.monthlyEmi;
  const foundationWeak = months < 3 || surplus <= 0;
  return {
    executiveSummary: foundationWeak
      ? `Before market moves: your foundation needs attention (emergency fund ${months.toFixed(1)} months${surplus <= 0 ? ', negative monthly surplus' : ''}). Fixing that outranks any stock decision.`
      : `Your foundation is solid (${months.toFixed(1)} months emergency cover, ${formatINR(surplus, { compact: true })}/month surplus). With a ${RISK_BAND_LABELS[p.riskBand]} profile and ${HORIZON_LABELS[p.horizon]} horizon, a disciplined SIP-led equity plan fits.`,
    recommendation: {
      action: foundationWeak ? 'WAIT' : 'DIVERSIFY',
      headline: foundationWeak ? 'Strengthen the base, then invest' : 'Run a SIP-first diversified plan; use the Portfolio Generator for exact numbers',
      details: foundationWeak
        ? `Route ${formatINR(Math.max(surplus, 0) || p.monthlySip, { compact: true })}/month to a liquid fund until the emergency fund reaches ${formatINR(p.monthlyExpenses * 6, { compact: true })}.`
        : `Ask me a specific question ("build a ₹5 lakh portfolio", "should I buy TCS?") or generate a full portfolio — I'll ground it in live data and your profile.`,
    },
    whyThisFitsYourProfile: fitBullets(p),
    marketAndSectorContext: marketContext(ctx.snapshot),
    fundamentalAnalysis: { summary: 'No specific stock referenced — ask about a stock for ratio-level analysis.', keyRatios: [] },
    technicalAnalysis: { summary: 'No specific stock referenced.', signals: [] },
    riskAssessment: {
      level: foundationWeak ? 'ELEVATED' : 'MODERATE',
      summary: foundationWeak
        ? 'Investing without a buffer forces selling at the worst time when life intervenes.'
        : 'Standard market risk applies; your buffer lets you ride out drawdowns.',
    },
    suggestedAllocation: [],
    investmentHorizon: HORIZON_LABELS[p.horizon],
    keyRisks: foundationWeak
      ? ['A job loss or medical event would force liquidating investments at a loss', 'Inflation erodes idle cash — the fix is a liquid fund, not equity']
      : ['Concentration creep — rebalance on schedule', 'Behaviour risk: stopping SIPs in a crash is the classic wealth-killer'],
    catalysts: ctx.snapshot.sentiment.drivers,
    pros: [],
    cons: [],
    alternatives: [],
    actionItems: foundationWeak
      ? [`Open a liquid fund and automate ${formatINR(Math.max(surplus, 5000), { compact: true })}/month`, 'Revisit equity once 3 months of expenses are covered', 'Use the SIP calculator to see the step-up impact']
      : ['Generate a portfolio in the Portfolio tab for exact allocations', `Keep the ${formatINR(p.monthlySip, { compact: true })} SIP running regardless of headlines`, 'Review sector exposure quarterly'],
    confidence: 70,
    dataNote: dataNote(ctx),
    disclaimer: SEBI_DISCLAIMER,
  };
}

function alternativesFor(o: StockOverview): AdvisorResponse['alternatives'] {
  const sector = o.universe?.sector;
  const alts: Record<string, { symbol: string; name: string; reason: string }[]> = {
    TECHNOLOGY: [
      { symbol: 'INFY', name: 'Infosys', reason: 'Similar franchise, higher dividend yield' },
      { symbol: 'HCLTECH', name: 'HCL Technologies', reason: 'Cheaper valuation in the same sector' },
    ],
    BANKING: [
      { symbol: 'ICICIBANK', name: 'ICICI Bank', reason: 'Best-in-class ROE among large private banks' },
      { symbol: 'SBIN', name: 'State Bank of India', reason: 'Value option at a lower P/B' },
    ],
    ENERGY: [
      { symbol: 'NTPC', name: 'NTPC', reason: 'Steadier utility cash flows with a ~2%+ dividend' },
      { symbol: 'POWERGRID', name: 'Power Grid', reason: 'Defensive yield play in the power chain' },
    ],
    AUTO: [
      { symbol: 'MARUTI', name: 'Maruti Suzuki', reason: 'Domestic demand proxy with a cleaner balance sheet' },
      { symbol: 'M&M', name: 'Mahindra & Mahindra', reason: 'SUV + tractor cycle exposure' },
    ],
  };
  const list = (sector && alts[sector]) || [
    { symbol: 'HDFCBANK', name: 'HDFC Bank', reason: 'Core compounder alternative outside this sector' },
    { symbol: null as unknown as string, name: 'Nifty 50 Index Fund', reason: 'Own the market instead of one stock' },
  ];
  return list.filter((a) => a.symbol !== o.quote.symbol).map((a) => ({ symbol: a.symbol ?? null, name: a.name, reason: a.reason }));
}

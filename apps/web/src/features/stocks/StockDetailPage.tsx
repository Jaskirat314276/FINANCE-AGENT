import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts';
import { ArrowLeftIcon, EyeIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { formatINR, formatNumber, SECTOR_LABELS, type CandleRange } from '@seeker/shared';
import { GlassCard, CardTitle } from '@/components/ui/card';
import { Badge, ChangeBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton, EmptyState } from '@/components/ui/misc';
import { ChartTooltipFrame, ChartCaption } from '@/components/charts/ChartBits';
import { CHART } from '@/lib/utils';
import { useAddToWatchlist, useAiSummary, useCandles, useStockOverview } from './api';

const RANGES: CandleRange[] = ['1M', '3M', '6M', '1Y', '3Y', '5Y'];

export default function StockDetailPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const [range, setRange] = useState<CandleRange>('1Y');
  const [aiRequested, setAiRequested] = useState(false);
  const { data: overview, isLoading, isError } = useStockOverview(symbol);
  const { data: candleData } = useCandles(symbol, range);
  const { data: ai, isFetching: aiLoading } = useAiSummary(symbol, aiRequested);
  const addToWatchlist = useAddToWatchlist();

  if (isLoading) return <DetailSkeleton />;
  if (isError || !overview) {
    return (
      <EmptyState
        title={`Couldn't load ${symbol}`}
        message="The symbol may be unlisted or every data provider is unreachable."
        action={<Link to="/app/stocks"><Button variant="secondary">Back to discovery</Button></Link>}
      />
    );
  }

  const { quote, fundamentals: f, technicals: t, universe, news, analystRating } = overview;
  const candles = candleData?.candles ?? [];
  const chartData = candles.map((c) => ({ date: c.time, close: Math.round(c.close * 100) / 100 }));
  const positiveRange = chartData.length > 1 && chartData[chartData.length - 1]!.close >= chartData[0]!.close;

  const verdictTone = { POSITIVE: 'good', NEUTRAL: 'neutral', CAUTIOUS: 'warning', NEGATIVE: 'critical' } as const;

  const fundamentalRows: Array<[string, string]> = [
    ['Market cap', f.marketCap !== null ? formatINR(f.marketCap, { compact: true }) : '—'],
    ['P/E', formatNumber(f.pe, 1)],
    ['EPS', f.eps !== null ? `₹${formatNumber(f.eps, 1)}` : '—'],
    ['P/B', formatNumber(f.pb, 1)],
    ['ROE', f.roe !== null ? `${f.roe.toFixed(1)}%` : '—'],
    ['ROCE', f.roce !== null ? `${f.roce.toFixed(1)}%` : '—'],
    ['Debt / Equity', formatNumber(f.debtToEquity, 2)],
    ['Revenue (TTM)', f.revenue !== null ? formatINR(f.revenue, { compact: true }) : '—'],
    ['Revenue growth', f.revenueGrowthPct !== null ? `${f.revenueGrowthPct.toFixed(1)}%` : '—'],
    ['Profit growth', f.profitGrowthPct !== null ? `${f.profitGrowthPct.toFixed(1)}%` : '—'],
    ['Dividend yield', f.dividendYieldPct !== null ? `${f.dividendYieldPct.toFixed(2)}%` : '—'],
    ['Beta', formatNumber(f.beta, 2)],
    ['52-week high', f.fiftyTwoWeekHigh !== null ? `₹${formatNumber(f.fiftyTwoWeekHigh, 0)}` : '—'],
    ['52-week low', f.fiftyTwoWeekLow !== null ? `₹${formatNumber(f.fiftyTwoWeekLow, 0)}` : '—'],
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/app/stocks" className="mb-2 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300">
            <ArrowLeftIcon className="h-3.5 w-3.5" /> Discovery
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{quote.symbol}</h1>
            {universe && <Badge tone="info">{SECTOR_LABELS[universe.sector]}</Badge>}
            {universe && <Badge>{universe.mcap} CAP</Badge>}
            {analystRating.rating && (
              <Badge tone={analystRating.rating.includes('BUY') ? 'good' : analystRating.rating.includes('SELL') ? 'critical' : 'neutral'}>
                Model view: {analystRating.rating.replace('_', ' ')}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-400">{quote.name}</p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold tabular-nums text-white">₹{quote.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            <ChangeBadge value={quote.changePct} />
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {quote.stale ? 'last known price · ' : ''}source: {quote.source} · day {quote.dayLow.toFixed(0)}–{quote.dayHigh.toFixed(0)}
          </p>
          <Button
            size="sm"
            variant="secondary"
            className="mt-2"
            onClick={() => symbol && addToWatchlist.mutate(symbol)}
            loading={addToWatchlist.isPending}
          >
            <EyeIcon className="h-4 w-4" /> Watch
          </Button>
        </div>
      </div>

      {/* Price chart */}
      <GlassCard>
        <div className="mb-4 flex items-center justify-between">
          <CardTitle className="mb-0">Price history</CardTitle>
          <div className="flex gap-1">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  range === r ? 'bg-accent/15 text-accent-soft' : 'text-slate-500 hover:bg-white/[0.06] hover:text-slate-300'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="h-72">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                <defs>
                  <linearGradient id="price-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={positiveRange ? CHART.up : CHART.down} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={positiveRange ? CHART.up : CHART.down} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={CHART.grid} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={48} />
                <YAxis domain={['auto', 'auto']} tickLine={false} axisLine={false} width={62} tickFormatter={(v: number) => `₹${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}`} />
                <Tooltip
                  content={({ active, payload, label }) =>
                    active && payload?.length ? (
                      <ChartTooltipFrame title={String(label)} rows={[{ label: 'Close', value: `₹${Number(payload[0]!.value).toLocaleString('en-IN')}`, color: positiveRange ? CHART.up : CHART.down }]} />
                    ) : null
                  }
                />
                {t.sma200 !== null && range !== '1M' && range !== '3M' && (
                  <ReferenceLine y={t.sma200} stroke={CHART.muted} strokeDasharray="4 4" label={{ value: '200-DMA', position: 'insideTopRight', fill: 'var(--text-muted)', fontSize: 10 }} />
                )}
                <Area type="monotone" dataKey="close" stroke={positiveRange ? CHART.up : CHART.down} strokeWidth={2} fill="url(#price-fill)" name="Close" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">No candle data for this range</div>
          )}
        </div>
        <ChartCaption>Daily closes · {quote.currency} · dashed line marks the 200-day moving average.</ChartCaption>
      </GlassCard>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Fundamentals */}
        <GlassCard>
          <CardTitle action={<span className="text-[10px] text-slate-500">source: {f.source}</span>}>Fundamentals</CardTitle>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
            {fundamentalRows.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between border-b border-white/[0.04] pb-2">
                <dt className="text-xs text-slate-500">{k}</dt>
                <dd className="text-sm font-semibold tabular-nums text-slate-200">{v}</dd>
              </div>
            ))}
          </dl>
        </GlassCard>

        {/* Technicals */}
        <GlassCard>
          <CardTitle
            action={
              <Badge tone={t.trend === 'BULLISH' ? 'good' : t.trend === 'BEARISH' ? 'critical' : 'neutral'}>{t.trend}</Badge>
            }
          >
            Technical analysis
          </CardTitle>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
            {([
              ['RSI (14)', t.rsi14 !== null ? t.rsi14.toFixed(1) : '—'],
              ['MACD', t.macd ? t.macd.line.toFixed(1) : '—'],
              ['MACD signal', t.macd ? t.macd.signal.toFixed(1) : '—'],
              ['MACD histogram', t.macd ? t.macd.histogram.toFixed(1) : '—'],
              ['SMA 20', t.sma20 !== null ? `₹${t.sma20.toFixed(0)}` : '—'],
              ['SMA 50', t.sma50 !== null ? `₹${t.sma50.toFixed(0)}` : '—'],
              ['SMA 200', t.sma200 !== null ? `₹${t.sma200.toFixed(0)}` : '—'],
              ['Bollinger mid', t.bollinger ? `₹${t.bollinger.middle.toFixed(0)}` : '—'],
              ['Support', t.support !== null ? `₹${t.support.toFixed(0)}` : '—'],
              ['Resistance', t.resistance !== null ? `₹${t.resistance.toFixed(0)}` : '—'],
            ] as Array<[string, string]>).map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between border-b border-white/[0.04] pb-2">
                <dt className="text-xs text-slate-500">{k}</dt>
                <dd className="text-sm font-semibold tabular-nums text-slate-200">{v}</dd>
              </div>
            ))}
          </dl>
          <ul className="mt-4 space-y-1.5">
            {t.signals.map((s) => (
              <li key={s} className="flex items-start gap-2 text-xs text-slate-400">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" /> {s}
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>

      {/* AI summary */}
      <GlassCard>
        <CardTitle action={<SparklesIcon className="h-4 w-4 text-accent" />}>Seeker's verdict for you</CardTitle>
        {!aiRequested ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-slate-400">
              Generate a personalized read on {quote.symbol} — bull case, bear case and whether it fits your risk profile.
            </p>
            <Button onClick={() => setAiRequested(true)}>
              <SparklesIcon className="h-4 w-4" /> Analyze for my profile
            </Button>
          </div>
        ) : aiLoading || !ai ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge tone={verdictTone[ai.verdict]}>{ai.verdict}</Badge>
              <span className="text-xs text-slate-500">confidence {ai.confidence}/100</span>
            </div>
            <p className="text-sm leading-relaxed text-slate-300">{ai.summary}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="glass-inset p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-300">Bull case</p>
                <ul className="space-y-1.5 text-xs text-slate-400">
                  {ai.bullCase.map((b) => <li key={b}>▲ {b}</li>)}
                </ul>
              </div>
              <div className="glass-inset p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-300">Bear case</p>
                <ul className="space-y-1.5 text-xs text-slate-400">
                  {ai.bearCase.map((b) => <li key={b}>▼ {b}</li>)}
                </ul>
              </div>
            </div>
            {ai.fitForUser && (
              <p className="glass-inset px-4 py-3 text-xs leading-relaxed text-slate-300">
                <span className="font-semibold text-accent-soft">Fit for you: </span>
                {ai.fitForUser}
              </p>
            )}
          </div>
        )}
      </GlassCard>

      {/* News */}
      <GlassCard>
        <CardTitle>Recent news</CardTitle>
        {news.length === 0 ? (
          <p className="text-sm text-slate-500">No recent news available from the current data providers.</p>
        ) : (
          <div className="space-y-3">
            {news.slice(0, 6).map((n) => (
              <a key={n.url + n.title} href={n.url} target="_blank" rel="noreferrer" className="block rounded-xl px-3 py-2.5 transition hover:bg-white/[0.05]">
                <p className="text-sm text-slate-200">{n.title}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {n.source} · {new Date(n.publishedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </a>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex justify-between">
        <Skeleton className="h-16 w-64" />
        <Skeleton className="h-16 w-40" />
      </div>
      <Skeleton className="h-80" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}

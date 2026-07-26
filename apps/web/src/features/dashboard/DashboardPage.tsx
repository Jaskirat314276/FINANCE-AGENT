import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  ArrowRightIcon, BanknotesIcon, ChartPieIcon, LightBulbIcon,
  ReceiptPercentIcon, ShieldCheckIcon, SparklesIcon, ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { formatINR, RISK_BAND_LABELS, SECTOR_LABELS } from '@seeker/shared';
import { GlassCard, CardTitle } from '@/components/ui/card';
import { ChangeBadge, Badge } from '@/components/ui/badge';
import { Progress, ScoreRing } from '@/components/ui/progress';
import { Skeleton, Stat, EmptyState } from '@/components/ui/misc';
import { inrTooltip, LegendRow } from '@/components/charts/ChartBits';
import { seriesColor } from '@/lib/utils';
import { useDashboard, useMarketSnapshot, useTrending } from './api';

const SUGGESTION_ICONS = {
  shield: ShieldCheckIcon,
  trend: ChartPieIcon,
  tax: ReceiptPercentIcon,
  warning: ExclamationTriangleIcon,
  spark: LightBulbIcon,
} as const;

export default function DashboardPage() {
  const { data: summary, isLoading } = useDashboard();
  const { data: snapshot } = useMarketSnapshot();
  const { data: trending } = useTrending();

  if (isLoading || !summary) return <DashboardSkeleton />;

  const sentimentTone =
    snapshot?.sentiment.label.includes('BULLISH') ? 'good' : snapshot?.sentiment.label.includes('BEARISH') ? 'critical' : 'neutral';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header + indices strip */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">Welcome back,</p>
          <h1 className="text-2xl font-bold text-white">{summary.user.name}</h1>
        </div>
        <Link to="/app/advisor" className="group">
          <span className="glass glass-hover inline-flex items-center gap-2 px-4 py-2.5 text-sm text-accent-soft">
            <SparklesIcon className="h-4 w-4" /> Ask your advisor
            <ArrowRightIcon className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
          </span>
        </Link>
      </div>

      {snapshot && (
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-slim">
          {snapshot.indices.map((idx) => (
            <div key={idx.key} className="glass min-w-[168px] shrink-0 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wider text-slate-500">{idx.name}</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-bold tabular-nums text-white">{idx.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                <ChangeBadge value={idx.changePct} />
              </div>
            </div>
          ))}
          <div className="glass min-w-[190px] shrink-0 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-slate-500">Market sentiment</p>
            <div className="mt-1 flex items-center gap-2">
              <Badge tone={sentimentTone === 'good' ? 'good' : sentimentTone === 'critical' ? 'critical' : 'neutral'}>
                {snapshot.sentiment.label.replace('_', ' ')}
              </Badge>
              <span className="text-xs tabular-nums text-slate-400">{snapshot.sentiment.score}</span>
            </div>
          </div>
        </div>
      )}

      {/* Stat row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Net worth" value={formatINR(summary.netWorth, { compact: true })} icon={<BanknotesIcon className="h-5 w-5" />} sub={`${formatINR(summary.investedTotal, { compact: true })} invested`} />
        <Stat label="Monthly investment" value={formatINR(summary.monthlyInvestment, { compact: true })} sub={`of ${formatINR(Math.max(summary.monthlySurplus, 0), { compact: true })} surplus`} />
        <div className="glass flex items-center justify-between p-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Risk profile</p>
            <p className="mt-2 text-lg font-bold text-white">{RISK_BAND_LABELS[summary.riskBand]}</p>
            <p className="text-xs text-slate-500">score {summary.riskScore}/100</p>
          </div>
          <ScoreRing value={summary.riskScore} label="risk" size={84} tone="var(--series-1)" />
        </div>
        <div className="glass flex items-center justify-between p-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Financial health</p>
            <p className="mt-2 text-lg font-bold text-white">{summary.financialHealth.grade.replace('_', ' ')}</p>
            <p className="text-xs text-slate-500">readiness {summary.investmentReadiness.score}/100</p>
          </div>
          <ScoreRing value={summary.financialHealth.score} label="health" size={84} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Asset allocation */}
        <GlassCard className="lg:col-span-1">
          <CardTitle>Asset allocation</CardTitle>
          {summary.assetAllocation.length === 0 ? (
            <EmptyState title="Nothing invested yet" message="Generate a portfolio to get started." action={<Link to="/app/portfolio" className="text-sm text-accent">Open generator →</Link>} />
          ) : (
            <>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={summary.assetAllocation}
                      dataKey="value"
                      nameKey="label"
                      innerRadius="58%"
                      outerRadius="88%"
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {summary.assetAllocation.map((slice, i) => (
                        <Cell key={slice.label} fill={seriesColor(i)} />
                      ))}
                    </Pie>
                    <Tooltip content={inrTooltip} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <LegendRow items={summary.assetAllocation.map((a, i) => ({ label: a.label, color: seriesColor(i) }))} />
            </>
          )}
        </GlassCard>

        {/* Goals */}
        <GlassCard className="lg:col-span-2">
          <CardTitle action={<Link to="/app/tools" className="text-xs text-accent hover:underline">Goal planner →</Link>}>
            Goal progress
          </CardTitle>
          {summary.goalProgress.length === 0 ? (
            <EmptyState title="No goals defined" message="Add goals in your profile to track funding progress." />
          ) : (
            <div className="space-y-5">
              {summary.goalProgress.map((g) => (
                <div key={g.label}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-200">{g.label}</span>
                    <span className="text-xs text-slate-400">
                      {formatINR(g.inflatedTarget, { compact: true })} in {g.targetYears}y ·{' '}
                      <span className={g.onTrack ? 'text-emerald-300' : 'text-amber-300'}>
                        {g.onTrack ? 'on track' : `needs ${formatINR(g.requiredSip, { compact: true })}/mo`}
                      </span>
                    </span>
                  </div>
                  <Progress value={g.fundedPct} tone={g.onTrack ? 'good' : g.fundedPct >= 50 ? 'warning' : 'critical'} />
                  <p className="mt-1 text-[11px] text-slate-500">
                    {g.fundedPct}% funded at current pace (₹{g.allocatedSip.toLocaleString('en-IN')}/mo allocated)
                  </p>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* AI suggestions */}
        <GlassCard className="lg:col-span-2">
          <CardTitle action={<SparklesIcon className="h-4 w-4 text-accent" />}>Seeker suggests</CardTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {summary.suggestions.map((s) => {
              const Icon = SUGGESTION_ICONS[s.icon];
              return (
                <div key={s.title} className="glass-inset p-4">
                  <div className="flex items-center gap-2 text-accent-soft">
                    <Icon className="h-4 w-4 shrink-0" />
                    <p className="text-sm font-semibold text-slate-100">{s.title}</p>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{s.detail}</p>
                </div>
              );
            })}
          </div>
        </GlassCard>

        {/* Trending */}
        <GlassCard>
          <CardTitle action={<Link to="/app/stocks" className="text-xs text-accent hover:underline">All stocks →</Link>}>
            Trending today
          </CardTitle>
          <div className="space-y-1.5">
            {(trending?.stocks ?? []).slice(0, 6).map((s) => (
              <Link key={s.symbol} to={`/app/stocks/${s.symbol}`} className="flex items-center justify-between rounded-lg px-2 py-2 transition hover:bg-white/[0.05]">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-200">{s.symbol}</p>
                  <p className="truncate text-[11px] text-slate-500">{SECTOR_LABELS[s.sector]}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm tabular-nums text-slate-300">₹{s.price.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</p>
                  <ChangeBadge value={s.changePct} />
                </div>
              </Link>
            ))}
            {!trending && [...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}
          </div>
        </GlassCard>
      </div>

      {/* Sector pulse */}
      {snapshot && (
        <GlassCard>
          <CardTitle action={<Link to="/app/insights" className="text-xs text-accent hover:underline">Full insights →</Link>}>
            Sector pulse
          </CardTitle>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {snapshot.sectorPerformance.slice(0, 14).map((s) => (
              <div key={s.sector} className="glass-inset flex flex-col gap-1 px-3 py-2.5">
                <span className="truncate text-[11px] text-slate-400">{SECTOR_LABELS[s.sector]}</span>
                <ChangeBadge value={s.avgChangePct} className="self-start" />
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </motion.div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="flex gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-44" />)}</div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Skeleton className="h-80" />
        <Skeleton className="h-80 lg:col-span-2" />
      </div>
    </div>
  );
}

import type { AdvisorResponse, AdvisorMeta } from '@seeker/shared';
import { formatINR } from '@seeker/shared';
import {
  BoltIcon, CheckCircleIcon, ExclamationTriangleIcon, LightBulbIcon,
  ScaleIcon, ArrowTrendingUpIcon, ArrowsRightLeftIcon, ClockIcon,
} from '@heroicons/react/24/outline';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { GlassCard } from '@/components/ui/card';
import { inrTooltip, LegendRow } from '@/components/charts/ChartBits';
import { seriesColor } from '@/lib/utils';

/** Renders the full 12-section structured advisory. */
export function AdvisorResponseView({ response, meta }: { response: AdvisorResponse; meta?: AdvisorMeta }) {
  const r = response;
  const actionTone =
    ['BUY', 'ACCUMULATE', 'INVEST'].includes(r.recommendation.action) ? 'good'
    : ['AVOID', 'SELL'].includes(r.recommendation.action) ? 'critical'
    : ['WAIT'].includes(r.recommendation.action) ? 'warning' : 'info';

  const riskTone =
    r.riskAssessment.level === 'LOW' ? 'good'
    : r.riskAssessment.level === 'MODERATE' ? 'info'
    : r.riskAssessment.level === 'ELEVATED' ? 'warning' : 'critical';

  return (
    <div className="space-y-4">
      {/* 1. Executive summary + recommendation */}
      <GlassCard className="border-accent/20">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={actionTone} className="text-xs font-bold">{r.recommendation.action}</Badge>
          <Badge tone={riskTone}>Risk: {r.riskAssessment.level.replace('_', ' ')}</Badge>
          <span className="ml-auto flex items-center gap-2 text-xs text-slate-500">
            Confidence
            <span className="inline-block w-24"><Progress value={r.confidence} tone={r.confidence >= 65 ? 'good' : r.confidence >= 45 ? 'warning' : 'critical'} className="h-1.5" /></span>
            <span className="tabular-nums text-slate-300">{r.confidence}/100</span>
          </span>
        </div>
        <h2 className="mt-3 text-lg font-bold text-white">{r.recommendation.headline}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">{r.executiveSummary}</p>
        {r.recommendation.details && <p className="mt-2 text-sm leading-relaxed text-slate-400">{r.recommendation.details}</p>}
      </GlassCard>

      {/* 3. Why this fits */}
      {r.whyThisFitsYourProfile.length > 0 && (
        <Section icon={<CheckCircleIcon className="h-4 w-4" />} title="Why this fits your profile">
          <ul className="space-y-2">
            {r.whyThisFitsYourProfile.map((w) => (
              <li key={w} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" /> {w}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* 4. Market context */}
      {r.marketAndSectorContext && (
        <Section icon={<ArrowTrendingUpIcon className="h-4 w-4" />} title="Market & sector context">
          <p className="text-sm leading-relaxed text-slate-300">{r.marketAndSectorContext}</p>
        </Section>
      )}

      {/* 5+6. Fundamental & technical */}
      <div className="grid gap-4 lg:grid-cols-2">
        {(r.fundamentalAnalysis.summary || r.fundamentalAnalysis.keyRatios.length > 0) && (
          <Section icon={<ScaleIcon className="h-4 w-4" />} title="Fundamental analysis">
            {r.fundamentalAnalysis.summary && <p className="mb-3 text-sm leading-relaxed text-slate-300">{r.fundamentalAnalysis.summary}</p>}
            <div className="space-y-2">
              {r.fundamentalAnalysis.keyRatios.map((ratio) => (
                <div key={ratio.name} className="glass-inset flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-200">{ratio.name}</p>
                    {ratio.comment && <p className="truncate text-[11px] text-slate-500">{ratio.comment}</p>}
                  </div>
                  <span className={`shrink-0 text-sm font-bold tabular-nums ${ratio.read === 'POSITIVE' ? 'text-emerald-300' : ratio.read === 'NEGATIVE' ? 'text-red-300' : 'text-slate-300'}`}>
                    {ratio.value}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}
        {(r.technicalAnalysis.summary || r.technicalAnalysis.signals.length > 0) && (
          <Section icon={<BoltIcon className="h-4 w-4" />} title="Technical analysis">
            {r.technicalAnalysis.summary && <p className="mb-3 text-sm leading-relaxed text-slate-300">{r.technicalAnalysis.summary}</p>}
            <ul className="space-y-1.5">
              {r.technicalAnalysis.signals.map((s) => (
                <li key={s} className="flex items-start gap-2 text-xs text-slate-400">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-series-1" /> {s}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      {/* 8. Allocation */}
      {r.suggestedAllocation.length > 0 && (
        <Section icon={<ArrowsRightLeftIcon className="h-4 w-4" />} title="Suggested allocation">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={r.suggestedAllocation.map((a) => ({ ...a, value: a.pct }))} dataKey="value" nameKey="label" innerRadius="55%" outerRadius="86%" paddingAngle={2} strokeWidth={0}>
                    {r.suggestedAllocation.map((a, i) => <Cell key={a.label} fill={seriesColor(i)} />)}
                  </Pie>
                  <Tooltip content={({ active, payload }) => active && payload?.length ? inrTooltip({ active, payload: payload.map((p) => ({ ...p, value: `${p.value}%` })) }) : null} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2.5">
              {r.suggestedAllocation.map((a, i) => (
                <div key={a.label} className="flex items-start gap-2.5">
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: seriesColor(i) }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-medium text-slate-200">{a.label}</p>
                      <p className="shrink-0 text-sm font-bold tabular-nums text-white">
                        {a.pct}%{a.amount !== null ? ` · ${formatINR(a.amount, { compact: true })}` : ''}
                      </p>
                    </div>
                    {a.note && <p className="text-[11px] text-slate-500">{a.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* 7+9. Risk + horizon */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Section icon={<ExclamationTriangleIcon className="h-4 w-4" />} title="Risk assessment">
          <p className="text-sm leading-relaxed text-slate-300">{r.riskAssessment.summary}</p>
          {r.keyRisks.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {r.keyRisks.map((k) => (
                <li key={k} className="flex items-start gap-2 text-xs text-slate-400">
                  <span className="mt-0.5 shrink-0 text-status-serious">⚠</span> {k}
                </li>
              ))}
            </ul>
          )}
        </Section>
        <div className="space-y-4">
          <Section icon={<ClockIcon className="h-4 w-4" />} title="Investment horizon">
            <p className="text-sm text-slate-300">{r.investmentHorizon}</p>
          </Section>
          {r.catalysts.length > 0 && (
            <Section icon={<BoltIcon className="h-4 w-4" />} title="Catalysts to watch">
              <ul className="space-y-1.5">
                {r.catalysts.map((c) => (
                  <li key={c} className="flex items-start gap-2 text-xs text-slate-400">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-status-warning" /> {c}
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>

      {/* Pros / cons */}
      {(r.pros.length > 0 || r.cons.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          <GlassCard>
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-emerald-300">Pros</p>
            <ul className="space-y-1.5 text-xs text-slate-400">{r.pros.map((p) => <li key={p}>▲ {p}</li>)}</ul>
          </GlassCard>
          <GlassCard>
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-red-300">Cons</p>
            <ul className="space-y-1.5 text-xs text-slate-400">{r.cons.map((c) => <li key={c}>▼ {c}</li>)}</ul>
          </GlassCard>
        </div>
      )}

      {/* 11. Alternatives */}
      {r.alternatives.length > 0 && (
        <Section icon={<ArrowsRightLeftIcon className="h-4 w-4" />} title="Alternatives">
          <div className="grid gap-2.5 sm:grid-cols-2">
            {r.alternatives.map((a) => (
              <div key={a.name} className="glass-inset p-3.5">
                <p className="text-sm font-semibold text-slate-200">
                  {a.symbol ? <span className="text-accent-soft">{a.symbol}</span> : null} {a.name}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{a.reason}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* 12. Action items */}
      {r.actionItems.length > 0 && (
        <Section icon={<LightBulbIcon className="h-4 w-4" />} title="Actionable next steps">
          <ol className="space-y-2.5">
            {r.actionItems.map((a, i) => (
              <li key={a} className="flex items-start gap-3 text-sm text-slate-300">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-bold text-accent-soft">{i + 1}</span>
                {a}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {/* Footer: data note + meta + disclaimer */}
      <div className="glass-inset space-y-2 px-4 py-3.5">
        {r.dataNote && <p className="text-[11px] leading-relaxed text-slate-500"><span className="font-semibold text-slate-400">Data note: </span>{r.dataNote}</p>}
        {meta && (
          <p className="text-[11px] text-slate-600">
            {meta.demoMode ? 'rule engine (demo mode)' : `${meta.provider} · ${meta.model}`} · {(meta.latencyMs / 1000).toFixed(1)}s
            {meta.symbolsAnalyzed.length > 0 && ` · analyzed ${meta.symbolsAnalyzed.join(', ')}`}
          </p>
        )}
        <p className="text-[11px] leading-relaxed text-slate-600">{r.disclaimer}</p>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <GlassCard>
      <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <span className="text-accent">{icon}</span> {title}
      </p>
      {children}
    </GlassCard>
  );
}

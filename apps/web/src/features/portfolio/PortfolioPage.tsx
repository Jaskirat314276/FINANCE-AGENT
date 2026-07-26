import { useState } from 'react';
import { motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { ArchiveBoxIcon, ArrowPathIcon, TrashIcon } from '@heroicons/react/24/outline';
import { formatINR, HORIZON_LABELS, RISK_BAND_LABELS, type GeneratedPortfolio } from '@seeker/shared';
import { api, ApiError } from '@/lib/api';
import { GlassCard, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Select } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SectionHeader, Skeleton } from '@/components/ui/misc';
import { toast } from '@/components/ui/toast';
import { MoneyInput } from '@/features/onboarding/bits';
import { inrTooltip, LegendRow, ChartCaption, ChartTooltipFrame } from '@/components/charts/ChartBits';
import { CHART, seriesColor } from '@/lib/utils';

export default function PortfolioPage() {
  const [amount, setAmount] = useState(500_000);
  const [sip, setSip] = useState(20_000);
  const [risk, setRisk] = useState('');
  const [horizon, setHorizon] = useState('');
  const [result, setResult] = useState<GeneratedPortfolio | null>(null);
  const qc = useQueryClient();

  const { data: saved } = useQuery({
    queryKey: ['portfolios'],
    queryFn: () => api.get<{ portfolios: GeneratedPortfolio[] }>('/portfolio'),
  });

  const generate = useMutation({
    mutationFn: () =>
      api.post<{ portfolio: GeneratedPortfolio }>('/portfolio/generate', {
        amount,
        monthlySip: sip,
        ...(risk ? { riskOverride: risk } : {}),
        ...(horizon ? { horizonOverride: horizon } : {}),
      }),
    onSuccess: (d) => setResult(d.portfolio),
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Generation failed'),
  });

  const save = useMutation({
    mutationFn: (portfolio: GeneratedPortfolio) => api.post('/portfolio/save', { portfolio }),
    onSuccess: () => {
      toast.success('Portfolio saved');
      void qc.invalidateQueries({ queryKey: ['portfolios'] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/portfolio/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['portfolios'] }),
  });

  return (
    <div className="space-y-6">
      <SectionHeader title="Portfolio Generator" subtitle="Deterministic quant engine — allocation, stock picks, Monte Carlo projection, rebalancing plan" />

      {/* Controls */}
      <GlassCard>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="One-time amount">
            <MoneyInput value={amount} onChange={setAmount} />
          </Field>
          <Field label="Monthly SIP">
            <MoneyInput value={sip} onChange={setSip} />
          </Field>
          <Field label="Risk (optional override)">
            <Select value={risk} onChange={(e) => setRisk(e.target.value)}>
              <option value="">My profile's band</option>
              <option value="LOW">Conservative</option>
              <option value="MEDIUM">Moderate</option>
              <option value="AGGRESSIVE">Aggressive</option>
              <option value="VERY_AGGRESSIVE">Very aggressive</option>
            </Select>
          </Field>
          <Field label="Horizon (optional override)">
            <Select value={horizon} onChange={(e) => setHorizon(e.target.value)}>
              <option value="">My profile's horizon</option>
              <option value="LT_1Y">Under 1 year</option>
              <option value="Y1_3">1–3 years</option>
              <option value="Y3_5">3–5 years</option>
              <option value="Y5_10">5–10 years</option>
              <option value="GT_10Y">10+ years</option>
            </Select>
          </Field>
          <div className="flex items-end">
            <Button className="w-full" onClick={() => generate.mutate()} loading={generate.isPending}>
              <ArrowPathIcon className="h-4 w-4" /> Generate
            </Button>
          </div>
        </div>
      </GlassCard>

      {generate.isPending && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      )}

      {result && !generate.isPending && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          {/* Summary strip */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ['Expected CAGR', `${result.expectedCagrPct}%`, 'planning estimate'],
              ['Volatility', `${result.volatilityPct}%`, 'annualized'],
              ['Risk band', RISK_BAND_LABELS[result.riskBand], `score ${result.riskScore}`],
              ['P(loss at horizon)', `${(result.monteCarlo.probLoss * 100).toFixed(1)}%`, `${result.monteCarlo.simulations} simulations`],
              ['Rebalance', result.rebalancing.frequency.toLowerCase().replace('_', '-'), `${result.rebalancing.driftThresholdPct}% drift trigger`],
            ].map(([k, v, sub]) => (
              <div key={k} className="glass px-4 py-3.5">
                <p className="text-[11px] uppercase tracking-wider text-slate-500">{k}</p>
                <p className="mt-1 text-lg font-bold text-white">{v}</p>
                <p className="text-[11px] text-slate-500">{sub}</p>
              </div>
            ))}
          </div>

          {result.warnings.length > 0 && (
            <div className="glass border-status-warning/25 p-4">
              {result.warnings.map((w) => (
                <p key={w} className="flex items-start gap-2 text-xs leading-relaxed text-amber-200/90">
                  <span className="shrink-0">⚠</span> {w}
                </p>
              ))}
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Allocation */}
            <GlassCard>
              <CardTitle>Asset allocation — {formatINR(result.amount, { compact: true })}</CardTitle>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={result.allocation.map((a) => ({ name: a.label, value: a.amount }))} dataKey="value" nameKey="name" innerRadius="56%" outerRadius="88%" paddingAngle={2} strokeWidth={0}>
                      {result.allocation.map((a, i) => <Cell key={a.assetClass} fill={seriesColor(i)} />)}
                    </Pie>
                    <Tooltip content={inrTooltip} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 space-y-2">
                {result.allocation.map((a, i) => (
                  <div key={a.assetClass} className="flex items-start gap-2.5">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: seriesColor(i) }} />
                    <div className="flex-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-200">{a.label}</span>
                        <span className="font-semibold tabular-nums text-white">{a.pct}% · {formatINR(a.amount, { compact: true })}</span>
                      </div>
                      <p className="text-[11px] text-slate-500">{a.rationale}</p>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Monte Carlo fan */}
            <GlassCard>
              <CardTitle>Monte Carlo projection</CardTitle>
              <MonteCarloChart mc={result.monteCarlo} />
            </GlassCard>
          </div>

          {/* Stock picks */}
          {result.stocks.length > 0 && (
            <GlassCard>
              <CardTitle>Direct stock picks</CardTitle>
              <div className="overflow-x-auto scrollbar-slim">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.07] text-left text-[11px] uppercase tracking-wider text-slate-500">
                      <th className="pb-2.5 pr-4 font-medium">Stock</th>
                      <th className="pb-2.5 pr-4 font-medium">Weight</th>
                      <th className="pb-2.5 pr-4 font-medium">Amount</th>
                      <th className="pb-2.5 pr-4 font-medium">~Shares</th>
                      <th className="pb-2.5 font-medium">Why</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.stocks.map((s) => (
                      <tr key={s.symbol} className="border-b border-white/[0.04]">
                        <td className="py-3 pr-4">
                          <p className="font-medium text-slate-100">{s.symbol}</p>
                          <p className="text-[11px] text-slate-500">{s.name} · <Badge className="ml-0.5">{s.mcap}</Badge></p>
                        </td>
                        <td className="pr-4 tabular-nums text-slate-300">{s.weightPct.toFixed(1)}%</td>
                        <td className="pr-4 tabular-nums text-slate-300">{formatINR(s.amount, { compact: true })}</td>
                        <td className="pr-4 tabular-nums text-slate-300">{s.approxShares} @ ₹{s.price.toFixed(0)}</td>
                        <td className="max-w-sm text-xs text-slate-400">{s.rationale}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          )}

          {/* Funds + rebalancing */}
          <div className="grid gap-5 lg:grid-cols-2">
            <GlassCard>
              <CardTitle>Fund sleeve</CardTitle>
              <div className="space-y-3">
                {result.funds.map((fund) => (
                  <div key={fund.name} className="glass-inset p-3.5">
                    <div className="flex justify-between">
                      <p className="text-sm font-medium text-slate-200">{fund.name}</p>
                      <p className="text-sm font-bold tabular-nums text-white">{formatINR(fund.amount, { compact: true })}</p>
                    </div>
                    <p className="text-[11px] text-slate-500">{fund.category}</p>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{fund.rationale}</p>
                  </div>
                ))}
              </div>
            </GlassCard>
            <GlassCard>
              <CardTitle>Rebalancing plan</CardTitle>
              <p className="text-sm text-slate-300">
                <span className="font-semibold text-white">{result.rebalancing.frequency.replace('_', '-').toLowerCase()}</span> reviews,
                act on ±{result.rebalancing.driftThresholdPct}% drift.
              </p>
              <ul className="mt-3 space-y-2">
                {result.rebalancing.notes.map((n) => (
                  <li key={n} className="flex items-start gap-2 text-xs leading-relaxed text-slate-400">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" /> {n}
                  </li>
                ))}
              </ul>
              <Button className="mt-5 w-full" variant="secondary" onClick={() => save.mutate(result)} loading={save.isPending}>
                <ArchiveBoxIcon className="h-4 w-4" /> Save this portfolio
              </Button>
            </GlassCard>
          </div>
        </motion.div>
      )}

      {/* Saved portfolios */}
      <GlassCard>
        <CardTitle>Saved portfolios</CardTitle>
        {saved?.portfolios.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {saved.portfolios.map((p) => (
              <div key={p.id} className="glass-inset p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{p.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {formatINR(p.amount, { compact: true })} · {HORIZON_LABELS[p.horizon]} · {p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-IN') : ''}
                    </p>
                  </div>
                  <button onClick={() => p.id && remove.mutate(p.id)} className="text-slate-600 transition hover:text-status-critical" aria-label="Delete portfolio">
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <Badge tone="accent">{RISK_BAND_LABELS[p.riskBand]}</Badge>
                  <span className="text-slate-400">CAGR ~{p.expectedCagrPct}%</span>
                </div>
                <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={() => setResult(p)}>
                  View details
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Nothing saved yet — generate a portfolio and save it to compare over time.</p>
        )}
      </GlassCard>
    </div>
  );
}

export function MonteCarloChart({ mc }: { mc: GeneratedPortfolio['monteCarlo'] }) {
  const data = mc.percentiles.p50.map((_, i) => ({
    year: `Y${i + 1}`,
    p10: mc.percentiles.p10[i],
    p25: mc.percentiles.p25[i],
    p50: mc.percentiles.p50[i],
    p75: mc.percentiles.p75[i],
    p90: mc.percentiles.p90[i],
    invested: mc.invested[i],
  }));
  return (
    <>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis dataKey="year" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={58} tickFormatter={(v: number) => formatINR(v, { compact: true }).replace('₹', '')} />
            <Tooltip
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <ChartTooltipFrame
                    title={String(label)}
                    rows={payload
                      .filter((p) => ['p90', 'p50', 'p10', 'invested'].includes(String(p.dataKey)))
                      .map((p) => ({
                        label: { p90: 'Optimistic (p90)', p50: 'Median', p10: 'Pessimistic (p10)', invested: 'Invested' }[String(p.dataKey)] ?? String(p.dataKey),
                        value: formatINR(Number(p.value), { compact: true }),
                        color: p.color,
                      }))}
                  />
                ) : null
              }
            />
            <Area type="monotone" dataKey="p90" stroke="transparent" fill={CHART.primary} fillOpacity={0.1} name="p90" />
            <Area type="monotone" dataKey="p75" stroke="transparent" fill={CHART.primary} fillOpacity={0.16} name="p75" />
            <Area type="monotone" dataKey="p25" stroke="transparent" fill="var(--surface-1)" fillOpacity={1} name="p25" />
            <Area type="monotone" dataKey="p10" stroke="transparent" fill="var(--surface-1)" fillOpacity={1} name="p10" />
            <Area type="monotone" dataKey="p50" stroke={CHART.primary} strokeWidth={2} fill="transparent" name="Median" />
            <Area type="monotone" dataKey="invested" stroke={CHART.muted} strokeWidth={1.5} strokeDasharray="4 4" fill="transparent" name="Invested" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <LegendRow items={[
        { label: 'Median outcome', color: CHART.primary },
        { label: 'p25–p90 range', color: 'rgba(57,135,229,0.35)' },
        { label: 'Capital invested', color: 'var(--text-muted)' },
      ]} />
      <ChartCaption>
        {mc.simulations.toLocaleString()} simulated paths over {mc.years} years at {mc.expectedCagrPct}% expected CAGR / {mc.volatilityPct}% volatility.
        {' '}Probability of ending below invested capital: {(mc.probLoss * 100).toFixed(1)}%.
        {mc.probTarget !== undefined && ` Probability of reaching target: ${(mc.probTarget * 100).toFixed(0)}%.`}
        {' '}Estimates, not guarantees.
      </ChartCaption>
    </>
  );
}

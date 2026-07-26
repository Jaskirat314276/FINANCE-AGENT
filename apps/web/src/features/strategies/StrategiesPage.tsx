import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import type { StrategyBlueprint } from '@seeker/shared';
import { api } from '@/lib/api';
import { GlassCard } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { SectionHeader, Skeleton } from '@/components/ui/misc';
import { seriesColor } from '@/lib/utils';

const RISK_TONE = { LOW: 'good', MODERATE: 'info', HIGH: 'warning', VERY_HIGH: 'critical' } as const;

export default function StrategiesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['strategies'],
    queryFn: () => api.get<{ strategies: StrategyBlueprint[] }>('/strategies'),
  });

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Investment Strategies"
        subtitle="Eleven blueprints, ranked by fit with your risk band, horizon and style preferences"
      />
      {isLoading ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-72" />)}
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {(data?.strategies ?? []).map((s, i) => (
            <motion.div
              key={s.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <GlassCard className={`flex h-full flex-col ${i === 0 && s.fitScore !== undefined ? 'border-accent/30' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-white">{s.name}</h3>
                    <p className="text-xs text-slate-400">{s.tagline}</p>
                  </div>
                  {i === 0 && s.fitScore !== undefined && <Badge tone="accent">Best fit</Badge>}
                </div>

                {s.fitScore !== undefined && (
                  <div className="mt-3">
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Fit for you</span>
                      <span className="tabular-nums text-slate-300">{s.fitScore}/100</span>
                    </div>
                    <Progress value={s.fitScore} className="mt-1 h-1.5" tone={s.fitScore >= 70 ? 'good' : s.fitScore >= 45 ? 'warning' : 'critical'} />
                    {s.fitReason && <p className="mt-1 text-[11px] text-slate-500">{s.fitReason}</p>}
                  </div>
                )}

                {/* Allocation bar */}
                <div className="mt-4">
                  <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full">
                    {s.allocation.map((a, ai) => (
                      <div key={a.label} style={{ width: `${a.pct}%`, background: seriesColor(ai) }} title={`${a.label}: ${a.pct}%`} />
                    ))}
                  </div>
                  <div className="mt-2.5 space-y-1">
                    {s.allocation.map((a, ai) => (
                      <div key={a.label} className="flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-1.5 text-slate-400">
                          <span className="h-2 w-2 rounded-sm" style={{ background: seriesColor(ai) }} /> {a.label}
                        </span>
                        <span className="tabular-nums text-slate-300">{a.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="glass-inset px-2 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">CAGR</p>
                    <p className="text-sm font-bold text-white">{s.expectedCagrPct.min}–{s.expectedCagrPct.max}%</p>
                  </div>
                  <div className="glass-inset px-2 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Volatility</p>
                    <p className="text-sm font-bold text-white">~{s.volatilityPct}%</p>
                  </div>
                  <div className="glass-inset px-2 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Risk</p>
                    <Badge tone={RISK_TONE[s.risk]} className="mt-0.5">{s.risk.replace('_', ' ')}</Badge>
                  </div>
                </div>

                <div className="mt-4 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Suitable for</p>
                  <ul className="mt-1.5 space-y-1">
                    {s.suitableFor.map((u) => (
                      <li key={u} className="flex items-start gap-1.5 text-xs text-slate-400">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" /> {u}
                      </li>
                    ))}
                  </ul>
                </div>

                <p className="mt-3 border-t border-white/[0.06] pt-3 text-[11px] leading-relaxed text-slate-500">
                  {s.notes[0]} · Horizon: {s.horizon}
                </p>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowTrendingDownIcon, ArrowTrendingUpIcon, NewspaperIcon } from '@heroicons/react/24/outline';
import type { DailyInsight } from '@seeker/shared';
import { SECTOR_LABELS } from '@seeker/shared';
import { api } from '@/lib/api';
import { GlassCard, CardTitle } from '@/components/ui/card';
import { Badge, ChangeBadge } from '@/components/ui/badge';
import { SectionHeader, Skeleton } from '@/components/ui/misc';
import { ChartCaption } from '@/components/charts/ChartBits';
import { useMarketSnapshot } from '@/features/dashboard/api';
import { cn } from '@/lib/utils';

interface HeatTile {
  symbol: string;
  name: string;
  sector: string;
  mcap: string;
  price: number;
  changePct: number;
}

export default function InsightsPage() {
  const { data: snapshot } = useMarketSnapshot();
  const { data: insight, isLoading: insightLoading } = useQuery({
    queryKey: ['daily-insight'],
    queryFn: () => api.get<DailyInsight>('/insights/daily'),
    staleTime: 15 * 60_000,
  });
  const { data: heatmap } = useQuery({
    queryKey: ['heatmap'],
    queryFn: () => api.get<{ tiles: HeatTile[] }>('/market/heatmap'),
    refetchInterval: 5 * 60_000,
  });

  return (
    <div className="space-y-6">
      <SectionHeader title="Market Insights" subtitle="Daily AI commentary, sector performance, movers and the market heatmap" />

      {/* Daily brief */}
      <GlassCard className="border-accent/15">
        <CardTitle action={insight && <Badge tone="accent">{insight.date}</Badge>}>
          <span className="flex items-center gap-2"><NewspaperIcon className="h-4 w-4 text-accent" /> Today's brief</span>
        </CardTitle>
        {insightLoading || !insight ? (
          <div className="space-y-2.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm font-medium leading-relaxed text-slate-200">{insight.niftySummary}</p>
            <p className="text-sm leading-relaxed text-slate-300">{insight.commentary}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="glass-inset p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-300">Key takeaways</p>
                <ul className="space-y-1.5 text-xs text-slate-400">
                  {insight.keyTakeaways.map((t) => <li key={t}>• {t}</li>)}
                </ul>
              </div>
              <div className="glass-inset p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-300">Watch-outs</p>
                <ul className="space-y-1.5 text-xs text-slate-400">
                  {insight.watchouts.map((t) => <li key={t}>• {t}</li>)}
                </ul>
              </div>
            </div>
            {insight.sectorHighlights.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {insight.sectorHighlights.map((s) => (
                  <span key={s.sector} className="glass-inset px-3 py-1.5 text-xs text-slate-300">
                    <span className="font-semibold text-white">{s.sector}:</span> {s.note}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </GlassCard>

      {/* Movers */}
      <div className="grid gap-5 lg:grid-cols-2">
        <GlassCard>
          <CardTitle action={<ArrowTrendingUpIcon className="h-4 w-4 text-status-good" />}>Top gainers</CardTitle>
          <MoverList entries={snapshot?.topGainers ?? []} />
        </GlassCard>
        <GlassCard>
          <CardTitle action={<ArrowTrendingDownIcon className="h-4 w-4 text-status-critical" />}>Top losers</CardTitle>
          <MoverList entries={snapshot?.topLosers ?? []} />
        </GlassCard>
      </div>

      {/* Heatmap */}
      <GlassCard>
        <CardTitle>Market heatmap</CardTitle>
        {heatmap ? (
          <>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5 lg:grid-cols-8">
              {heatmap.tiles
                .slice()
                .sort((a, b) => b.changePct - a.changePct)
                .map((tile) => (
                  <Link
                    key={tile.symbol}
                    to={`/app/stocks/${tile.symbol}`}
                    className={cn(
                      'group rounded-lg border p-2 transition hover:scale-[1.03]',
                      heatClass(tile.changePct),
                    )}
                    title={`${tile.name} · ${tile.changePct.toFixed(2)}%`}
                  >
                    <p className="truncate text-[11px] font-bold text-white/90">{tile.symbol}</p>
                    <p className="text-[10px] tabular-nums text-white/70">{tile.changePct >= 0 ? '+' : ''}{tile.changePct.toFixed(1)}%</p>
                  </Link>
                ))}
            </div>
            <ChartCaption>
              Tiles are the tracked NSE universe, shaded by today's move (green = advancing, red = declining; deeper shade = larger move). Values are printed on every tile — color is reinforcement, not the only signal.
            </ChartCaption>
          </>
        ) : (
          <Skeleton className="h-48" />
        )}
      </GlassCard>

      {/* Sector table */}
      {snapshot && (
        <GlassCard>
          <CardTitle>Sector performance</CardTitle>
          <div className="divide-y divide-white/[0.05]">
            {snapshot.sectorPerformance.map((s) => (
              <div key={s.sector} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-slate-200">{SECTOR_LABELS[s.sector]}</span>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-slate-500">{s.advancers}▲ / {s.decliners}▼</span>
                  <ChangeBadge value={s.avgChangePct} />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}

function MoverList({ entries }: { entries: Array<{ symbol: string; name: string; price: number; changePct: number; sector: string }> }) {
  if (entries.length === 0) return <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>;
  return (
    <div className="divide-y divide-white/[0.05]">
      {entries.map((e) => (
        <Link key={e.symbol} to={`/app/stocks/${e.symbol}`} className="flex items-center justify-between py-2.5 transition hover:bg-white/[0.03]">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-100">{e.symbol}</p>
            <p className="truncate text-[11px] text-slate-500">{e.name}</p>
          </div>
          <div className="text-right">
            <p className="text-sm tabular-nums text-slate-300">₹{e.price.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</p>
            <ChangeBadge value={e.changePct} />
          </div>
        </Link>
      ))}
    </div>
  );
}

/** Sequential shading by magnitude — green arm up, red arm down, values always printed. */
function heatClass(changePct: number): string {
  if (changePct >= 2) return 'border-emerald-400/40 bg-emerald-500/35';
  if (changePct >= 1) return 'border-emerald-400/30 bg-emerald-500/25';
  if (changePct >= 0.25) return 'border-emerald-400/20 bg-emerald-500/15';
  if (changePct > -0.25) return 'border-white/10 bg-white/[0.05]';
  if (changePct > -1) return 'border-red-400/20 bg-red-500/15';
  if (changePct > -2) return 'border-red-400/30 bg-red-500/25';
  return 'border-red-400/40 bg-red-500/35';
}

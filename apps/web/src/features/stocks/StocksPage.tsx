import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MagnifyingGlassIcon, FunnelIcon } from '@heroicons/react/24/outline';
import { SECTORS, SECTOR_LABELS, formatINR, formatNumber } from '@seeker/shared';
import { GlassCard, CardTitle } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { ChangeBadge, Badge } from '@/components/ui/badge';
import { Skeleton, SectionHeader, EmptyState } from '@/components/ui/misc';
import { useDebounce } from '@/hooks/useDebounce';
import { useTrending } from '@/features/dashboard/api';
import { useScreener, useStockSearch } from './api';

export default function StocksPage() {
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 250);
  const { data: search, isFetching } = useStockSearch(debounced);
  const { data: trending } = useTrending();
  const navigate = useNavigate();

  // Screener state
  const [sector, setSector] = useState('');
  const [mcap, setMcap] = useState('');
  const [maxPe, setMaxPe] = useState('');
  const [minRoe, setMinRoe] = useState('');
  const [sort, setSort] = useState('roe');
  const screenerParams = useMemo(() => {
    const p: Record<string, string> = { sort, limit: '20' };
    if (sector) p.sector = sector;
    if (mcap) p.mcap = mcap;
    if (maxPe) p.maxPe = maxPe;
    if (minRoe) p.minRoe = minRoe;
    return p;
  }, [sector, mcap, maxPe, minRoe, sort]);
  const { data: screener, isLoading: screenerLoading } = useScreener(screenerParams);

  return (
    <div className="space-y-6">
      <SectionHeader title="Stock Discovery" subtitle="Search NSE stocks — prices, fundamentals, technicals and an AI verdict" />

      {/* Search */}
      <div className="relative max-w-xl">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
        <Input
          className="h-12 pl-11 text-base"
          placeholder="Search TCS, Infosys, Reliance, HAL, Zomato…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && search?.results[0]) navigate(`/app/stocks/${search.results[0].symbol}`);
          }}
          aria-label="Search stocks"
        />
        {debounced.length >= 2 && (
          <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-ink-800/95 shadow-glass backdrop-blur-xl">
            {isFetching && <p className="px-4 py-3 text-sm text-slate-400">Searching…</p>}
            {!isFetching && search?.results.length === 0 && <p className="px-4 py-3 text-sm text-slate-400">No matches for “{debounced}”</p>}
            {search?.results.map((r) => (
              <Link
                key={r.symbol}
                to={`/app/stocks/${r.symbol}`}
                className="flex items-center justify-between px-4 py-2.5 transition hover:bg-white/[0.06]"
                onClick={() => setQuery('')}
              >
                <div>
                  <span className="font-medium text-slate-100">{r.symbol}</span>
                  <span className="ml-2 text-xs text-slate-500">{r.name}</span>
                </div>
                <Badge tone={r.inUniverse ? 'accent' : 'neutral'}>{r.exchange}</Badge>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Trending strip */}
      <GlassCard>
        <CardTitle>Trending Indian stocks</CardTitle>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {(trending?.stocks ?? []).map((s) => (
            <Link key={s.symbol} to={`/app/stocks/${s.symbol}`} className="glass-inset glass-hover flex items-center justify-between px-3.5 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-100">{s.symbol}</p>
                <p className="truncate text-[11px] text-slate-500">₹{s.price.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</p>
              </div>
              <ChangeBadge value={s.changePct} />
            </Link>
          ))}
          {!trending && [...Array(8)].map((_, i) => <Skeleton key={i} className="h-14" />)}
        </div>
      </GlassCard>

      {/* Screener */}
      <GlassCard>
        <CardTitle action={<FunnelIcon className="h-4 w-4 text-slate-500" />}>Stock screener</CardTitle>
        <div className="mb-4 grid gap-3 sm:grid-cols-5">
          <Select value={sector} onChange={(e) => setSector(e.target.value)} aria-label="Sector filter">
            <option value="">All sectors</option>
            {SECTORS.map((s) => (
              <option key={s} value={s}>{SECTOR_LABELS[s]}</option>
            ))}
          </Select>
          <Select value={mcap} onChange={(e) => setMcap(e.target.value)} aria-label="Market cap filter">
            <option value="">Any market cap</option>
            <option value="LARGE">Large cap</option>
            <option value="MID">Mid cap</option>
            <option value="SMALL">Small cap</option>
          </Select>
          <Input type="number" placeholder="Max P/E" value={maxPe} onChange={(e) => setMaxPe(e.target.value)} aria-label="Maximum PE" />
          <Input type="number" placeholder="Min ROE %" value={minRoe} onChange={(e) => setMinRoe(e.target.value)} aria-label="Minimum ROE" />
          <Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by">
            <option value="roe">Sort: ROE</option>
            <option value="pe">Sort: Low P/E</option>
            <option value="divYield">Sort: Dividend</option>
            <option value="profitGrowth">Sort: Growth</option>
            <option value="marketCap">Sort: Size</option>
          </Select>
        </div>

        {screenerLoading ? (
          <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
        ) : screener && screener.results.length > 0 ? (
          <div className="overflow-x-auto scrollbar-slim">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-white/[0.07] text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="pb-2.5 pr-4 font-medium">Stock</th>
                  <th className="pb-2.5 pr-4 font-medium">Price</th>
                  <th className="pb-2.5 pr-4 font-medium">Change</th>
                  <th className="pb-2.5 pr-4 font-medium">P/E</th>
                  <th className="pb-2.5 pr-4 font-medium">ROE</th>
                  <th className="pb-2.5 pr-4 font-medium">Div yield</th>
                  <th className="pb-2.5 pr-4 font-medium">Profit growth</th>
                  <th className="pb-2.5 font-medium">Mkt cap</th>
                </tr>
              </thead>
              <tbody>
                {screener.results.map((r) => (
                  <tr
                    key={r.symbol}
                    onClick={() => navigate(`/app/stocks/${r.symbol}`)}
                    className="cursor-pointer border-b border-white/[0.04] transition hover:bg-white/[0.04]"
                  >
                    <td className="py-3 pr-4">
                      <p className="font-medium text-slate-100">{r.symbol}</p>
                      <p className="text-[11px] text-slate-500">{r.name}</p>
                    </td>
                    <td className="pr-4 tabular-nums text-slate-200">₹{r.price.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</td>
                    <td className="pr-4"><ChangeBadge value={r.changePct} /></td>
                    <td className="pr-4 tabular-nums text-slate-300">{formatNumber(r.pe, 1)}</td>
                    <td className="pr-4 tabular-nums text-slate-300">{r.roe !== null ? `${r.roe.toFixed(1)}%` : '—'}</td>
                    <td className="pr-4 tabular-nums text-slate-300">{r.divYieldPct !== null ? `${r.divYieldPct.toFixed(2)}%` : '—'}</td>
                    <td className="pr-4 tabular-nums text-slate-300">{r.profitGrowthPct !== null ? `${r.profitGrowthPct.toFixed(0)}%` : '—'}</td>
                    <td className="tabular-nums text-slate-300">{r.marketCap !== null ? formatINR(r.marketCap, { compact: true }) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[11px] text-slate-500">
              {screener.matched} of {screener.universeSize} tracked stocks matched your filters.
            </p>
          </div>
        ) : (
          <EmptyState title="No stocks match" message="Loosen the filters to see more of the universe." />
        )}
      </GlassCard>
    </div>
  );
}

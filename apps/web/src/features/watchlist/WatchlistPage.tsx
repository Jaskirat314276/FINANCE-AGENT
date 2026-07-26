import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellAlertIcon, BellIcon, EyeIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { Quote } from '@seeker/shared';
import { api, ApiError } from '@/lib/api';
import { GlassCard, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { ChangeBadge, Badge } from '@/components/ui/badge';
import { EmptyState, SectionHeader, Skeleton } from '@/components/ui/misc';
import { toast } from '@/components/ui/toast';

interface WatchItem {
  id: string;
  symbol: string;
  note: string | null;
  targetPrice: number | null;
  createdAt: string;
  quote: Quote | null;
}

interface AlertItem {
  id: string;
  symbol: string;
  kind: string;
  threshold: number | null;
  active: boolean;
  message: string | null;
  lastTriggeredAt: string | null;
}

const ALERT_KINDS = [
  { value: 'PRICE_ABOVE', label: 'Price rises above ₹X', needsThreshold: true },
  { value: 'PRICE_BELOW', label: 'Price falls below ₹X', needsThreshold: true },
  { value: 'PCT_MOVE', label: 'Daily move exceeds ±X%', needsThreshold: true },
  { value: 'RSI_OVERBOUGHT', label: 'RSI overbought (≥70)', needsThreshold: false },
  { value: 'RSI_OVERSOLD', label: 'RSI oversold (≤30)', needsThreshold: false },
  { value: 'NEWS', label: 'Fresh news in last 24h', needsThreshold: false },
  { value: 'FUNDAMENTAL', label: 'P/E drops below X', needsThreshold: true },
];

export default function WatchlistPage() {
  const qc = useQueryClient();
  const [newSymbol, setNewSymbol] = useState('');
  const [alertSymbol, setAlertSymbol] = useState('');
  const [alertKind, setAlertKind] = useState('PRICE_ABOVE');
  const [alertThreshold, setAlertThreshold] = useState('');

  const { data: watchlist, isLoading } = useQuery({
    queryKey: ['watchlist'],
    queryFn: () => api.get<{ items: WatchItem[] }>('/watchlist'),
    refetchInterval: 60_000,
  });

  const { data: alerts } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => api.get<{ alerts: AlertItem[] }>('/watchlist/alerts'),
  });

  const evaluate = useMutation({
    mutationFn: () => api.post<{ triggered: Array<{ symbol: string; message: string }> }>('/watchlist/alerts/evaluate'),
    onSuccess: (d) => {
      if (d.triggered.length === 0) toast.success('All quiet — no alerts triggered');
      d.triggered.forEach((t) => toast.warning(t.message));
      void qc.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  const add = useMutation({
    mutationFn: (symbol: string) => api.post('/watchlist', { symbol }),
    onSuccess: () => {
      setNewSymbol('');
      void qc.invalidateQueries({ queryKey: ['watchlist'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not add symbol'),
  });

  const remove = useMutation({
    mutationFn: (symbol: string) => api.delete(`/watchlist/${symbol}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['watchlist'] }),
  });

  const createAlert = useMutation({
    mutationFn: () =>
      api.post('/watchlist/alerts', {
        symbol: alertSymbol.toUpperCase(),
        kind: alertKind,
        ...(alertThreshold ? { threshold: Number(alertThreshold) } : {}),
      }),
    onSuccess: () => {
      toast.success('Alert created');
      setAlertThreshold('');
      void qc.invalidateQueries({ queryKey: ['alerts'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not create alert'),
  });

  const deleteAlert = useMutation({
    mutationFn: (id: string) => api.delete(`/watchlist/alerts/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['alerts'] }),
  });

  const needsThreshold = ALERT_KINDS.find((k) => k.value === alertKind)?.needsThreshold ?? false;
  const symbols = watchlist?.items.map((i) => i.symbol) ?? [];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Watchlist & Alerts"
        subtitle="Follow stocks and let Seeker watch prices, RSI, news and fundamentals for you"
        action={
          <Button variant="secondary" size="sm" onClick={() => evaluate.mutate()} loading={evaluate.isPending}>
            <BellAlertIcon className="h-4 w-4" /> Check alerts now
          </Button>
        }
      />

      {/* Add symbol */}
      <GlassCard className="p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newSymbol.trim()) add.mutate(newSymbol.trim().toUpperCase());
          }}
          className="flex gap-3"
        >
          <Input
            placeholder="Add symbol — TCS, RELIANCE, HAL…"
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value)}
            className="max-w-xs uppercase"
            aria-label="Add stock symbol"
          />
          <Button type="submit" loading={add.isPending}>
            <PlusIcon className="h-4 w-4" /> Follow
          </Button>
        </form>
      </GlassCard>

      {/* Watchlist table */}
      <GlassCard>
        <CardTitle>Following ({watchlist?.items.length ?? 0})</CardTitle>
        {isLoading ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : watchlist?.items.length ? (
          <div className="divide-y divide-white/[0.05]">
            {watchlist.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 py-3">
                <Link to={`/app/stocks/${item.symbol}`} className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-100 hover:text-accent-soft">{item.symbol}</p>
                  <p className="truncate text-xs text-slate-500">{item.quote?.name ?? '—'}</p>
                </Link>
                {item.quote ? (
                  <div className="text-right">
                    <p className="tabular-nums text-slate-200">₹{item.quote.price.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</p>
                    <ChangeBadge value={item.quote.changePct} />
                  </div>
                ) : (
                  <span className="text-xs text-slate-500">no quote</span>
                )}
                <button onClick={() => remove.mutate(item.symbol)} className="ml-2 text-slate-600 transition hover:text-status-critical" aria-label={`Remove ${item.symbol}`}>
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={<EyeIcon className="h-8 w-8" />} title="Nothing followed yet" message="Add stocks above or from any stock page." />
        )}
      </GlassCard>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Create alert */}
        <GlassCard>
          <CardTitle>Create alert</CardTitle>
          {symbols.length === 0 ? (
            <p className="text-sm text-slate-500">Follow at least one stock to set alerts.</p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (alertSymbol) createAlert.mutate();
              }}
              className="space-y-4"
            >
              <Field label="Stock">
                <Select value={alertSymbol} onChange={(e) => setAlertSymbol(e.target.value)}>
                  <option value="">Choose…</option>
                  {symbols.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
              <Field label="Condition">
                <Select value={alertKind} onChange={(e) => setAlertKind(e.target.value)}>
                  {ALERT_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                </Select>
              </Field>
              {needsThreshold && (
                <Field label="Threshold">
                  <Input type="number" step="any" value={alertThreshold} onChange={(e) => setAlertThreshold(e.target.value)} placeholder="e.g. 4200" />
                </Field>
              )}
              <Button type="submit" className="w-full" loading={createAlert.isPending} disabled={!alertSymbol || (needsThreshold && !alertThreshold)}>
                <BellIcon className="h-4 w-4" /> Set alert
              </Button>
            </form>
          )}
        </GlassCard>

        {/* Active alerts */}
        <GlassCard>
          <CardTitle>Your alerts ({alerts?.alerts.length ?? 0})</CardTitle>
          {alerts?.alerts.length ? (
            <div className="space-y-2.5">
              {alerts.alerts.map((a) => (
                <div key={a.id} className="glass-inset flex items-start justify-between gap-3 p-3.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-200">
                      {a.symbol} <Badge className="ml-1">{a.kind.replace(/_/g, ' ')}</Badge>
                      {a.threshold !== null && <span className="ml-1.5 text-xs text-slate-400">@ {a.threshold}</span>}
                    </p>
                    {a.message && a.lastTriggeredAt && (
                      <p className="mt-1 text-xs text-amber-200/80">
                        🔔 {a.message}
                        <span className="ml-1 text-slate-500">({new Date(a.lastTriggeredAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })})</span>
                      </p>
                    )}
                  </div>
                  <button onClick={() => deleteAlert.mutate(a.id)} className="text-slate-600 transition hover:text-status-critical" aria-label="Delete alert">
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No alerts yet. Alerts are checked when you press “Check alerts now” (wire a cron for continuous checks — see docs).</p>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

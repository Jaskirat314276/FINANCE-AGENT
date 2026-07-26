import type { ReactNode } from 'react';
import { formatINR } from '@seeker/shared';

/**
 * Shared chart chrome per the dataviz spec: a glass tooltip that wears text
 * tokens (identity comes from a colored swatch, never colored text), and a
 * legend row for multi-series charts.
 */

export interface TooltipRow {
  label: string;
  value: string;
  color?: string;
}

export function ChartTooltipFrame({ title, rows }: { title?: string; rows: TooltipRow[] }) {
  return (
    <div className="rounded-xl border border-white/12 bg-ink-800/95 px-3 py-2.5 shadow-glass backdrop-blur-md">
      {title && <p className="mb-1.5 text-[11px] font-semibold text-slate-300">{title}</p>}
      <div className="space-y-1">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-slate-400">
              {r.color && <span className="h-2 w-2 rounded-sm" style={{ background: r.color }} />}
              {r.label}
            </span>
            <span className="font-semibold tabular-nums text-slate-100">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Recharts-compatible tooltip renderer for ₹ series (loose types on purpose —
 *  Recharts' generic payload shapes vary by chart; we normalize here). */
export function inrTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ name?: unknown; value?: unknown; color?: string; dataKey?: unknown }>;
  label?: unknown;
}) {
  if (!active || !payload?.length) return null;
  return (
    <ChartTooltipFrame
      title={label !== undefined && label !== null ? String(label) : undefined}
      rows={payload.map((p) => ({
        label: String(p.name ?? p.dataKey ?? ''),
        value: typeof p.value === 'number' ? formatINR(p.value, { compact: true }) : String(p.value ?? ''),
        color: p.color,
      }))}
    />
  );
}

export function LegendRow({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function ChartCaption({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{children}</p>;
}

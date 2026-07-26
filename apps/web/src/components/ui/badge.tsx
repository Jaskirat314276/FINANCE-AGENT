import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'accent' | 'good' | 'warning' | 'critical' | 'info';

const tones: Record<Tone, string> = {
  neutral: 'bg-white/[0.07] text-slate-300 border-white/10',
  accent: 'bg-accent/15 text-accent-soft border-accent/25',
  good: 'bg-status-good/15 text-emerald-300 border-status-good/30',
  warning: 'bg-status-warning/15 text-amber-300 border-status-warning/30',
  critical: 'bg-status-critical/15 text-red-300 border-status-critical/30',
  info: 'bg-series-1/15 text-blue-300 border-series-1/30',
};

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

/** Price-change pill: color + arrow (never color alone). */
export function ChangeBadge({ value, className }: { value: number; className?: string }) {
  const up = value >= 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums',
        up ? 'bg-status-good/15 text-emerald-300' : 'bg-status-critical/15 text-red-300',
        className,
      )}
    >
      {up ? '▲' : '▼'} {Math.abs(value).toFixed(2)}%
    </span>
  );
}

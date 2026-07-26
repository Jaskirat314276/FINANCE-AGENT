import { cn } from '@/lib/utils';

export function Progress({
  value,
  className,
  tone = 'accent',
}: {
  value: number;
  className?: string;
  tone?: 'accent' | 'good' | 'warning' | 'critical' | 'info';
}) {
  const tones = {
    accent: 'from-accent-deep to-accent',
    good: 'from-emerald-700 to-status-good',
    warning: 'from-amber-700 to-status-warning',
    critical: 'from-red-800 to-status-critical',
    info: 'from-blue-700 to-series-1',
  } as const;
  return (
    <div
      className={cn('h-2 w-full overflow-hidden rounded-full bg-white/[0.07]', className)}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700', tones[tone])}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

/** Score ring (0–100) for risk / health scores. */
export function ScoreRing({
  value,
  label,
  size = 96,
  tone,
}: {
  value: number;
  label: string;
  size?: number;
  tone?: string;
}) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const color = tone ?? (value >= 70 ? 'var(--status-good)' : value >= 45 ? 'var(--status-warning)' : 'var(--status-critical)');
  return (
    <div className="relative inline-flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="7" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - Math.min(100, Math.max(0, value)) / 100)}
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-white tabular-nums">{Math.round(value)}</span>
        <span className="text-[9px] uppercase tracking-wider text-slate-500">{label}</span>
      </div>
    </div>
  );
}

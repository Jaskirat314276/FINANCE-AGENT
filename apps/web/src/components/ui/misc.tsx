import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-xl bg-gradient-to-r from-white/[0.04] via-white/[0.08] to-white/[0.04] bg-[length:400px_100%]',
        className,
      )}
      {...props}
    />
  );
}

/** Selectable pill for multi-choice steps. */
export function Chip({
  selected,
  onClick,
  children,
  className,
  disabled,
}: {
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'rounded-xl border px-3.5 py-2 text-sm transition-all duration-150 disabled:opacity-40',
        selected
          ? 'border-accent/60 bg-accent/15 font-medium text-accent-soft shadow-glow'
          : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/25 hover:bg-white/[0.07]',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Stat tile — hero number pattern from the dataviz spec. */
export function Stat({
  label,
  value,
  sub,
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('glass p-5', className)}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
        {icon && <span className="text-accent">{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: ReactNode;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="glass flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon && <div className="mb-1 text-slate-500">{icon}</div>}
      <p className="font-semibold text-slate-200">{title}</p>
      {message && <p className="max-w-sm text-sm text-slate-400">{message}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

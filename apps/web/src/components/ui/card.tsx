import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function GlassCard({
  className,
  hover,
  ...props
}: HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return <div className={cn('glass p-5', hover && 'glass-hover cursor-pointer', className)} {...props} />;
}

export function CardTitle({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-4 flex items-center justify-between gap-3', className)}>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">{children}</h3>
      {action}
    </div>
  );
}

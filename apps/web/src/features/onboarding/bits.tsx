import { type ReactNode } from 'react';
import { formatINR } from '@seeker/shared';
import { Input } from '@/components/ui/input';
import { Chip } from '@/components/ui/misc';
import { cn } from '@/lib/utils';

/** ₹ input with live lakh/crore reading. */
export function MoneyInput({
  value,
  onChange,
  placeholder,
  max = 1_000_00_00_000,
}: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  max?: number;
}) {
  return (
    <div>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-500">₹</span>
        <Input
          type="number"
          min={0}
          max={max}
          inputMode="numeric"
          className="pl-8"
          placeholder={placeholder ?? '0'}
          value={value === 0 ? '' : value}
          onChange={(e) => {
            const v = e.target.value === '' ? 0 : Math.max(0, Number(e.target.value));
            onChange(Number.isFinite(v) ? v : 0);
          }}
        />
      </div>
      {value > 0 && <p className="mt-1 text-[11px] text-slate-500">{formatINR(value, { compact: true })}</p>}
    </div>
  );
}

/** Single-select option grid. */
export function OptionGrid<T extends string>({
  options,
  value,
  onChange,
  labels,
  columns = 3,
}: {
  options: readonly T[];
  value: T | null;
  onChange: (v: T) => void;
  labels?: Partial<Record<T, string>>;
  columns?: 2 | 3 | 4 | 5;
}) {
  const cols = { 2: 'grid-cols-2', 3: 'grid-cols-2 sm:grid-cols-3', 4: 'grid-cols-2 sm:grid-cols-4', 5: 'grid-cols-2 sm:grid-cols-5' }[columns];
  return (
    <div className={cn('grid gap-2', cols)}>
      {options.map((opt) => (
        <Chip key={opt} selected={value === opt} onClick={() => onChange(opt)} className="text-center">
          {labels?.[opt] ?? pretty(opt)}
        </Chip>
      ))}
    </div>
  );
}

/** Multi-select chips. */
export function MultiChips<T extends string>({
  options,
  values,
  onToggle,
  labels,
}: {
  options: readonly T[];
  values: T[];
  onToggle: (v: T) => void;
  labels?: Partial<Record<T, string>>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <Chip key={opt} selected={values.includes(opt)} onClick={() => onToggle(opt)}>
          {labels?.[opt] ?? pretty(opt)}
        </Chip>
      ))}
    </div>
  );
}

export function StepBlock({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div>
        <p className="text-sm font-medium text-slate-200">{title}</p>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export function pretty(v: string): string {
  return v
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

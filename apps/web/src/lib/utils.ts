import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind-aware class combiner (shadcn convention). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Validated dark-mode categorical chart palette (fixed slot order — never cycle). */
export const CHART_SERIES = [
  'var(--series-1)',
  'var(--series-2)',
  'var(--series-3)',
  'var(--series-4)',
  'var(--series-5)',
  'var(--series-6)',
  'var(--series-7)',
  'var(--series-8)',
] as const;

export const CHART = {
  up: 'var(--status-good)',
  down: 'var(--status-critical)',
  warning: 'var(--status-warning)',
  grid: 'var(--grid-hairline)',
  muted: 'var(--text-muted)',
  primary: 'var(--series-1)',
  accent: '#34d399',
} as const;

export function seriesColor(index: number): string {
  return CHART_SERIES[index % CHART_SERIES.length]!;
}

export function changeColor(value: number): string {
  return value >= 0 ? CHART.up : CHART.down;
}

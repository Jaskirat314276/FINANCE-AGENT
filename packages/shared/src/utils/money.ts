/** Indian-format money helpers (lakh / crore aware). */

export function formatINR(value: number, opts: { compact?: boolean; decimals?: number } = {}): string {
  const { compact = false, decimals } = opts;
  if (!Number.isFinite(value)) return '—';
  if (compact) {
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    if (abs >= 1e12) return `${sign}₹${(abs / 1e12).toFixed(2)} L Cr`;
    if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)} Cr`;
    if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(2)} L`;
    if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(1)}K`;
    return `${sign}₹${abs.toFixed(0)}`;
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: decimals ?? 0,
  }).format(value);
}

export function formatPct(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

export function formatNumber(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: decimals }).format(value);
}

/** Future value of a monthly SIP at annual rate r% for n years. */
export function sipFutureValue(monthly: number, annualRatePct: number, years: number): number {
  const i = annualRatePct / 100 / 12;
  const n = Math.round(years * 12);
  if (i === 0) return monthly * n;
  return monthly * ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
}

/** Future value of a lump sum. */
export function lumpSumFutureValue(principal: number, annualRatePct: number, years: number): number {
  return principal * Math.pow(1 + annualRatePct / 100, years);
}

/** Monthly SIP required to reach a target. */
export function sipRequiredForTarget(target: number, annualRatePct: number, years: number): number {
  const i = annualRatePct / 100 / 12;
  const n = Math.round(years * 12);
  if (n <= 0) return target;
  if (i === 0) return target / n;
  return target / (((Math.pow(1 + i, n) - 1) / i) * (1 + i));
}

/** Inflation-adjust a present cost to a future nominal cost. */
export function inflate(presentValue: number, inflationPct: number, years: number): number {
  return presentValue * Math.pow(1 + inflationPct / 100, years);
}

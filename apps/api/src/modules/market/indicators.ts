import type { Candle, TechnicalSnapshot } from '@seeker/shared';

/**
 * Pure technical-analysis math. All functions take chronological candle/close
 * arrays (oldest → newest) and return null when there is insufficient data.
 */

export function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

export function emaSeries(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0]!;
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    prev = i === 0 ? v : v * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

export function ema(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const series = emaSeries(values, period);
  return series[series.length - 1] ?? null;
}

/** Wilder-smoothed RSI. */
export function rsi(values: number[], period = 14): number | null {
  if (values.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i]! - values[i - 1]!;
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i]! - values[i - 1]!;
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function macd(
  values: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9,
): { line: number; signal: number; histogram: number } | null {
  if (values.length < slow + signalPeriod) return null;
  const emaFast = emaSeries(values, fast);
  const emaSlow = emaSeries(values, slow);
  const macdLine = emaFast.map((v, i) => v - emaSlow[i]!);
  const signalSeries = emaSeries(macdLine.slice(slow - 1), signalPeriod);
  const line = macdLine[macdLine.length - 1]!;
  const signal = signalSeries[signalSeries.length - 1]!;
  return { line, signal, histogram: line - signal };
}

export function bollinger(
  values: number[],
  period = 20,
  mult = 2,
): { upper: number; middle: number; lower: number } | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  return { upper: mean + mult * sd, middle: mean, lower: mean - mult * sd };
}

/** Swing-point support/resistance from the last ~60 sessions. */
export function supportResistance(
  candles: Candle[],
  lookback = 60,
  window = 4,
): { support: number | null; resistance: number | null } {
  const recent = candles.slice(-lookback);
  if (recent.length < window * 2 + 5) return { support: null, resistance: null };
  const last = recent[recent.length - 1]!.close;
  const lows: number[] = [];
  const highs: number[] = [];
  for (let i = window; i < recent.length - window; i++) {
    const c = recent[i]!;
    let isLow = true;
    let isHigh = true;
    for (let j = i - window; j <= i + window; j++) {
      if (recent[j]!.low < c.low) isLow = false;
      if (recent[j]!.high > c.high) isHigh = false;
    }
    if (isLow) lows.push(c.low);
    if (isHigh) highs.push(c.high);
  }
  const support = lows.filter((l) => l < last).sort((a, b) => b - a)[0] ?? null;
  const resistance = highs.filter((h) => h > last).sort((a, b) => a - b)[0] ?? null;
  return { support, resistance };
}

/** Full snapshot + composite trend + human-readable signals. */
export function computeTechnicals(symbol: string, candles: Candle[]): TechnicalSnapshot {
  const closes = candles.map((c) => c.close);
  const last = closes[closes.length - 1] ?? null;

  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const sma200 = sma(closes, 200);
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const rsi14 = rsi(closes, 14);
  const macdVal = macd(closes);
  const boll = bollinger(closes);
  const { support, resistance } = supportResistance(candles);

  const signals: string[] = [];
  let bullPoints = 0;
  let totalPoints = 0;

  if (last !== null && sma200 !== null) {
    totalPoints += 2;
    if (last > sma200) {
      bullPoints += 2;
      signals.push('Price above 200-DMA — long-term uptrend intact');
    } else {
      signals.push('Price below 200-DMA — long-term trend under pressure');
    }
  }
  if (sma50 !== null && sma200 !== null) {
    totalPoints += 1;
    if (sma50 > sma200) {
      bullPoints += 1;
      signals.push('50-DMA above 200-DMA (golden-cross regime)');
    } else {
      signals.push('50-DMA below 200-DMA (death-cross regime)');
    }
  }
  if (rsi14 !== null) {
    totalPoints += 1;
    if (rsi14 >= 70) signals.push(`RSI ${rsi14.toFixed(0)} — overbought, entry may be extended`);
    else if (rsi14 <= 30) {
      signals.push(`RSI ${rsi14.toFixed(0)} — oversold, watch for reversal`);
      bullPoints += 0.5;
    } else {
      signals.push(`RSI ${rsi14.toFixed(0)} — neutral zone`);
      bullPoints += rsi14 > 50 ? 1 : 0;
    }
  }
  if (macdVal) {
    totalPoints += 1;
    if (macdVal.histogram > 0) {
      bullPoints += 1;
      signals.push('MACD histogram positive — momentum improving');
    } else {
      signals.push('MACD histogram negative — momentum soft');
    }
  }
  if (last !== null && sma20 !== null) {
    totalPoints += 1;
    if (last > sma20) bullPoints += 1;
    signals.push(last > sma20 ? 'Trading above 20-DMA (short-term strength)' : 'Trading below 20-DMA (short-term weakness)');
  }

  const ratio = totalPoints > 0 ? bullPoints / totalPoints : 0.5;
  const trend: TechnicalSnapshot['trend'] = ratio >= 0.65 ? 'BULLISH' : ratio <= 0.35 ? 'BEARISH' : 'NEUTRAL';

  return {
    symbol,
    sma20,
    sma50,
    sma200,
    ema12,
    ema26,
    rsi14,
    macd: macdVal,
    bollinger: boll,
    support,
    resistance,
    trend,
    signals,
    asOf: new Date().toISOString(),
  };
}

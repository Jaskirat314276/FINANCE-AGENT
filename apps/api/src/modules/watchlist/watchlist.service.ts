import { prisma } from '../../lib/prisma';
import { ApiError } from '../../middleware/error';
import * as market from '../market/market.service';
import type { AlertKind } from '@prisma/client';

/** Watchlist + alert rules. Alerts are evaluated on demand (poll model). */

export async function list(userId: string) {
  const items = await prisma.watchlistItem.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  const withQuotes = await Promise.all(
    items.map(async (item) => {
      const quote = await market.getQuote(item.symbol).catch(() => null);
      return {
        id: item.id,
        symbol: item.symbol,
        note: item.note,
        targetPrice: item.targetPrice,
        createdAt: item.createdAt.toISOString(),
        quote,
      };
    }),
  );
  return withQuotes;
}

export async function add(userId: string, symbol: string, note?: string, targetPrice?: number) {
  // Validate the symbol resolves to a quote before saving
  await market.getQuote(symbol).catch(() => {
    throw ApiError.badRequest(`Could not find a quote for "${symbol}"`, 'UNKNOWN_SYMBOL');
  });
  const existing = await prisma.watchlistItem.findUnique({
    where: { userId_symbol: { userId, symbol } },
  });
  if (existing) throw ApiError.conflict(`${symbol} is already in your watchlist`);
  return prisma.watchlistItem.create({ data: { userId, symbol, note, targetPrice } });
}

export async function remove(userId: string, symbol: string) {
  const result = await prisma.watchlistItem.deleteMany({ where: { userId, symbol } });
  if (result.count === 0) throw ApiError.notFound('Not in watchlist');
}

export async function createAlert(
  userId: string,
  input: { symbol: string; kind: AlertKind; threshold?: number },
) {
  return prisma.alert.create({
    data: { userId, symbol: input.symbol, kind: input.kind, threshold: input.threshold ?? null },
  });
}

export async function listAlerts(userId: string) {
  return prisma.alert.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
}

export async function deleteAlert(userId: string, id: string) {
  const result = await prisma.alert.deleteMany({ where: { id, userId } });
  if (result.count === 0) throw ApiError.notFound('Alert not found');
}

/**
 * Evaluate all active alerts against live data. Triggered alerts get a
 * message + lastTriggeredAt and are returned for the UI to surface.
 */
export async function evaluateAlerts(userId: string) {
  const alerts = await prisma.alert.findMany({ where: { userId, active: true } });
  const triggered: Array<{ id: string; symbol: string; message: string }> = [];

  for (const alert of alerts) {
    try {
      let message: string | null = null;
      if (alert.kind === 'PRICE_ABOVE' || alert.kind === 'PRICE_BELOW' || alert.kind === 'PCT_MOVE') {
        const quote = await market.getQuote(alert.symbol);
        if (alert.kind === 'PRICE_ABOVE' && alert.threshold !== null && quote.price >= alert.threshold) {
          message = `${alert.symbol} crossed above ₹${alert.threshold.toLocaleString('en-IN')} (now ₹${quote.price.toFixed(2)})`;
        } else if (alert.kind === 'PRICE_BELOW' && alert.threshold !== null && quote.price <= alert.threshold) {
          message = `${alert.symbol} fell below ₹${alert.threshold.toLocaleString('en-IN')} (now ₹${quote.price.toFixed(2)})`;
        } else if (alert.kind === 'PCT_MOVE' && alert.threshold !== null && Math.abs(quote.changePct) >= alert.threshold) {
          message = `${alert.symbol} moved ${quote.changePct.toFixed(2)}% today (threshold ±${alert.threshold}%)`;
        }
      } else if (alert.kind === 'RSI_OVERBOUGHT' || alert.kind === 'RSI_OVERSOLD') {
        const tech = await market.getTechnicals(alert.symbol);
        if (tech.rsi14 !== null) {
          const limit = alert.threshold ?? (alert.kind === 'RSI_OVERBOUGHT' ? 70 : 30);
          if (alert.kind === 'RSI_OVERBOUGHT' && tech.rsi14 >= limit) {
            message = `${alert.symbol} RSI at ${tech.rsi14.toFixed(0)} — overbought territory`;
          } else if (alert.kind === 'RSI_OVERSOLD' && tech.rsi14 <= limit) {
            message = `${alert.symbol} RSI at ${tech.rsi14.toFixed(0)} — oversold territory`;
          }
        }
      } else if (alert.kind === 'NEWS') {
        const news = await market.getNews(alert.symbol).catch(() => []);
        const fresh = news.filter((n) => Date.now() - new Date(n.publishedAt).getTime() < 24 * 3600_000);
        if (fresh.length > 0) message = `${alert.symbol}: ${fresh.length} news item(s) in the last 24h — "${fresh[0]!.title}"`;
      } else if (alert.kind === 'FUNDAMENTAL') {
        const f = await market.getFundamentals(alert.symbol);
        if (f.pe !== null && alert.threshold !== null && f.pe <= alert.threshold) {
          message = `${alert.symbol} P/E at ${f.pe.toFixed(1)} — at/below your ${alert.threshold} threshold`;
        }
      }

      if (message) {
        const hoursSinceLast = alert.lastTriggeredAt ? (Date.now() - alert.lastTriggeredAt.getTime()) / 3600_000 : Infinity;
        if (hoursSinceLast >= 6) {
          await prisma.alert.update({ where: { id: alert.id }, data: { lastTriggeredAt: new Date(), message } });
          triggered.push({ id: alert.id, symbol: alert.symbol, message });
        }
      }
    } catch {
      // one symbol failing shouldn't break evaluation of the rest
    }
  }
  return triggered;
}

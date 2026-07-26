import type { ChatMessageDto } from '@seeker/shared';
import { formatINR, RISK_BAND_LABELS } from '@seeker/shared';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../middleware/error';
import { logger } from '../../lib/logger';
import * as market from '../market/market.service';
import { getProfile } from '../profile/profile.service';
import { getLlm } from '../advisor/llm';
import { CHAT_SYSTEM_PROMPT } from '../advisor/prompts';
import { detectSymbols, marketBlock, profileBlock, stockBlock } from '../advisor/context';

/**
 * Conversational advisor. Same grounding pipeline as the structured
 * advisor, but free-form output and persistent multi-turn history.
 */

const HISTORY_WINDOW = 12;

export async function listSessions(userId: string) {
  const sessions = await prisma.chatSession.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, title: true, createdAt: true, updatedAt: true, _count: { select: { messages: true } } },
  });
  return sessions.map((s) => ({
    id: s.id,
    title: s.title,
    messageCount: s._count.messages,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));
}

export async function getMessages(userId: string, sessionId: string): Promise<ChatMessageDto[]> {
  const session = await prisma.chatSession.findFirst({ where: { id: sessionId, userId } });
  if (!session) throw ApiError.notFound('Conversation not found');
  const messages = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
  });
  return messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    structured: (m.structured as ChatMessageDto['structured']) ?? null,
    createdAt: m.createdAt.toISOString(),
  }));
}

export async function deleteSession(userId: string, sessionId: string): Promise<void> {
  const result = await prisma.chatSession.deleteMany({ where: { id: sessionId, userId } });
  if (result.count === 0) throw ApiError.notFound('Conversation not found');
}

export async function send(userId: string, message: string, sessionId?: string) {
  const profile = await getProfile(userId);

  const session = sessionId
    ? await prisma.chatSession.findFirst({ where: { id: sessionId, userId } })
    : await prisma.chatSession.create({
        data: { userId, title: message.slice(0, 60) + (message.length > 60 ? '…' : '') },
      });
  if (!session) throw ApiError.notFound('Conversation not found');

  await prisma.chatMessage.create({ data: { sessionId: session.id, role: 'user', content: message } });

  const history = await prisma.chatMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: 'desc' },
    take: HISTORY_WINDOW,
  });
  const ordered = history.reverse();

  // Grounding: profile + market + any stocks referenced in the latest message
  const symbols = detectSymbols(message).slice(0, 2);
  const [snapshot, overviews, watchlist] = await Promise.all([
    market.getMarketSnapshot(),
    Promise.all(symbols.map((s) => market.getOverview(s).catch(() => null))),
    prisma.watchlistItem.findMany({ where: { userId }, take: 10 }),
  ]);

  const watchlistNote = watchlist.length
    ? `\n=== USER WATCHLIST ===\n${watchlist.map((w) => w.symbol).join(', ')}`
    : '';

  const contextBlock = [
    profileBlock(profile),
    marketBlock(snapshot),
    ...overviews.filter((o): o is NonNullable<typeof o> => o !== null).map(stockBlock),
  ].join('\n\n');

  const llm = getLlm();
  let reply: string;
  if (llm) {
    try {
      reply = await llm.complete({
        system: `${CHAT_SYSTEM_PROMPT}\n\n=== CONTEXT (refreshed this turn) ===\n${contextBlock}${watchlistNote}`,
        messages: ordered.map((m) => ({ role: m.role === 'user' ? ('user' as const) : ('assistant' as const), content: m.content })),
        temperature: 0.5,
        maxTokens: 1500,
      });
    } catch (err) {
      logger.warn('chat LLM failed — deterministic fallback', { error: String(err) });
      reply = deterministicReply(message, profile, snapshot, symbols);
    }
  } else {
    reply = deterministicReply(message, profile, snapshot, symbols);
  }

  const savedReply = await prisma.chatMessage.create({
    data: { sessionId: session.id, role: 'assistant', content: reply },
  });
  await prisma.chatSession.update({ where: { id: session.id }, data: { updatedAt: new Date() } });

  return {
    sessionId: session.id,
    message: {
      id: savedReply.id,
      role: 'assistant' as const,
      content: reply,
      structured: null,
      createdAt: savedReply.createdAt.toISOString(),
    },
  };
}

function deterministicReply(
  message: string,
  profile: Awaited<ReturnType<typeof getProfile>>,
  snapshot: Awaited<ReturnType<typeof market.getMarketSnapshot>>,
  symbols: string[],
): string {
  const nifty = snapshot.indices.find((i) => i.key === 'NIFTY50');
  const surplus = profile.monthlyIncome - profile.monthlyExpenses - profile.monthlyEmi;
  const lines = [
    `*(Demo advisor — add a free Groq key in \`apps/api/.env\` to unlock full conversational AI.)*`,
    '',
    `Here's what I can tell you from your data right now:`,
    `• Market: ${nifty ? `NIFTY 50 at ${nifty.value.toFixed(0)} (${nifty.changePct >= 0 ? '+' : ''}${nifty.changePct.toFixed(2)}%)` : 'index data unavailable'}, sentiment ${snapshot.sentiment.label.toLowerCase().replace('_', ' ')}.`,
    `• You: ${RISK_BAND_LABELS[profile.riskBand]} risk profile (${profile.riskScore}/100), ${formatINR(surplus, { compact: true })}/month investable surplus, SIP ${formatINR(profile.monthlySip, { compact: true })}/month.`,
  ];
  if (symbols.length) {
    lines.push(`• You mentioned **${symbols.join(', ')}** — open the stock page or use the Advisor tab for the full structured breakdown with fundamentals + technicals.`);
  }
  lines.push(
    '',
    `For a complete, structured answer to "${message.slice(0, 80)}${message.length > 80 ? '…' : ''}", use the **AI Advisor** tab — the rule engine there produces the full 12-section analysis even in demo mode.`,
  );
  return lines.join('\n');
}

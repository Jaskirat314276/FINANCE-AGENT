import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { PaperAirplaneIcon, PlusIcon, TrashIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import type { ChatMessageDto } from '@seeker/shared';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

interface SessionSummary {
  id: string;
  title: string;
  messageCount: number;
  updatedAt: string;
}

export default function ChatPage() {
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [input, setInput] = useState('');
  const [pendingUserMsg, setPendingUserMsg] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data: sessions } = useQuery({
    queryKey: ['chat-sessions'],
    queryFn: () => api.get<{ sessions: SessionSummary[] }>('/chat/sessions'),
  });

  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['chat-messages', sessionId],
    queryFn: () => api.get<{ messages: ChatMessageDto[] }>(`/chat/sessions/${sessionId}`),
    enabled: !!sessionId,
  });

  const send = useMutation({
    mutationFn: (message: string) => api.post<{ sessionId: string; message: ChatMessageDto }>('/chat/send', { message, sessionId }),
    onSuccess: (d) => {
      setSessionId(d.sessionId);
      setPendingUserMsg(null);
      void qc.invalidateQueries({ queryKey: ['chat-messages', d.sessionId] });
      void qc.invalidateQueries({ queryKey: ['chat-sessions'] });
    },
    onError: (e) => {
      setPendingUserMsg(null);
      toast.error(e instanceof ApiError ? e.message : 'Message failed');
    },
  });

  const removeSession = useMutation({
    mutationFn: (id: string) => api.delete(`/chat/sessions/${id}`),
    onSuccess: (_d, id) => {
      if (id === sessionId) setSessionId(undefined);
      void qc.invalidateQueries({ queryKey: ['chat-sessions'] });
    },
  });

  const submit = () => {
    const value = input.trim();
    if (!value || send.isPending) return;
    setPendingUserMsg(value);
    setInput('');
    send.mutate(value);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingUserMsg]);

  const displayMessages: ChatMessageDto[] = [
    ...(messages?.messages ?? []),
    ...(pendingUserMsg ? [{ id: 'pending', role: 'user' as const, content: pendingUserMsg, createdAt: new Date().toISOString() }] : []),
  ];

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-5 lg:h-[calc(100vh-5.5rem)]">
      {/* Sessions rail */}
      <aside className="hidden w-64 shrink-0 flex-col gap-2 md:flex">
        <Button variant="secondary" onClick={() => setSessionId(undefined)} className="justify-start">
          <PlusIcon className="h-4 w-4" /> New conversation
        </Button>
        <div className="glass flex-1 overflow-y-auto p-2 scrollbar-slim">
          {sessions?.sessions.length ? (
            sessions.sessions.map((s) => (
              <div
                key={s.id}
                className={cn(
                  'group flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2.5 transition',
                  s.id === sessionId ? 'bg-accent/12 text-accent-soft' : 'text-slate-400 hover:bg-white/[0.05]',
                )}
                onClick={() => setSessionId(s.id)}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm">{s.title}</p>
                  <p className="text-[10px] text-slate-600">{s.messageCount} messages</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSession.mutate(s.id);
                  }}
                  className="hidden text-slate-600 hover:text-status-critical group-hover:block"
                  aria-label="Delete conversation"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          ) : (
            <p className="px-3 py-4 text-xs text-slate-500">No conversations yet.</p>
          )}
        </div>
      </aside>

      {/* Chat panel */}
      <div className="glass flex min-w-0 flex-1 flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-4 scrollbar-slim sm:p-6">
          {!sessionId && displayMessages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <ChatBubbleLeftRightIcon className="h-10 w-10 text-accent/50" />
              <p className="mt-3 font-semibold text-slate-200">Chat with your advisor</p>
              <p className="mt-1 max-w-sm text-sm text-slate-400">
                Seeker knows your profile, portfolio, watchlist and live market data. Ask follow-ups naturally — context carries across the conversation.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {['How am I doing financially?', 'What should I do with my bonus?', "Explain today's market move"].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setPendingUserMsg(s);
                      send.mutate(s);
                    }}
                    className="rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs text-slate-400 transition hover:border-accent/40 hover:text-accent-soft"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messagesLoading && sessionId && <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className={cn('h-16', i % 2 ? 'ml-auto w-2/3' : 'w-3/4')} />)}</div>}

          {displayMessages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[75%]',
                  m.role === 'user'
                    ? 'rounded-br-md bg-gradient-to-br from-accent-deep/80 to-accent/70 text-ink-950'
                    : 'glass-inset rounded-bl-md text-slate-200',
                )}
              >
                <MessageBody content={m.content} />
              </div>
            </motion.div>
          ))}

          {send.isPending && (
            <div className="flex justify-start">
              <div className="glass-inset flex items-center gap-1.5 rounded-2xl rounded-bl-md px-4 py-3.5">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" style={{ animationDelay: `${i * 0.18}s` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex items-end gap-3 border-t border-white/[0.06] p-4"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder="Message your advisor…"
            className="max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-xl border border-white/10 bg-ink-900/60 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-accent/50"
            aria-label="Chat message"
          />
          <Button type="submit" disabled={!input.trim()} loading={send.isPending} aria-label="Send">
            <PaperAirplaneIcon className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

/** Minimal markdown: **bold**, *italic*, bullet lines, line breaks. */
function MessageBody({ content }: { content: string }) {
  const html = content
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="rounded bg-white/10 px-1 py-0.5 text-[12px]">$1</code>')
    .split('\n')
    .map((line) => (line.trim().startsWith('•') || line.trim().startsWith('- ') ? `<span class="block pl-3">${line.replace(/^\s*-\s/, '• ')}</span>` : line))
    .join('<br/>')
    .replace(/(<br\/>){2,}/g, '<br/><br/>');
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

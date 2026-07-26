import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PaperAirplaneIcon, ClockIcon, SparklesIcon } from '@heroicons/react/24/outline';
import type { AdvisorResult } from '@seeker/shared';
import { api, ApiError } from '@/lib/api';
import { GlassCard } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SectionHeader, Skeleton } from '@/components/ui/misc';
import { toast } from '@/components/ui/toast';
import { AdvisorResponseView } from './AdvisorResponseView';

const SUGGESTED = [
  'Should I invest ₹50,000 today?',
  'What stocks fit my risk profile?',
  'Create a SIP portfolio for me',
  'Build a ₹10 lakh portfolio',
  'How should I diversify my investments?',
  'Should I invest in small caps now?',
  'How much cash should I hold?',
  'Should I buy Reliance today?',
  'Compare Infosys vs TCS',
  'Why is TCS falling?',
];

export default function AdvisorPage() {
  const [question, setQuestion] = useState('');
  const [current, setCurrent] = useState<AdvisorResult | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const qc = useQueryClient();

  const { data: historyData } = useQuery({
    queryKey: ['advisor-history'],
    queryFn: () => api.get<{ queries: AdvisorResult[] }>('/advisor/history'),
  });

  const ask = useMutation({
    mutationFn: (q: string) => api.post<AdvisorResult>('/advisor/ask', { question: q }),
    onSuccess: (result) => {
      setCurrent(result);
      void qc.invalidateQueries({ queryKey: ['advisor-history'] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'The advisor is unavailable right now'),
  });

  const submit = (q?: string) => {
    const value = (q ?? question).trim();
    if (value.length < 3 || ask.isPending) return;
    setQuestion(value);
    ask.mutate(value);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <SectionHeader
        title="AI Investment Advisor"
        subtitle="Grounded in your profile, live market data, fundamentals and technicals — never generic"
        action={
          <Button variant="ghost" size="sm" onClick={() => setShowHistory((v) => !v)}>
            <ClockIcon className="h-4 w-4" /> History
          </Button>
        }
      />

      {/* Ask box */}
      <GlassCard className="p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex items-end gap-3"
        >
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={2}
            placeholder='Ask anything — "Build a ₹5 lakh portfolio", "Should I buy HAL?"…'
            className="max-h-40 min-h-[3.25rem] flex-1 resize-y rounded-xl border border-white/10 bg-ink-900/60 px-3.5 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-accent/50"
            aria-label="Ask the advisor"
          />
          <Button type="submit" loading={ask.isPending} className="shrink-0" aria-label="Send question">
            <PaperAirplaneIcon className="h-4 w-4" />
            Ask
          </Button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTED.slice(0, 6).map((s) => (
            <button
              key={s}
              onClick={() => submit(s)}
              disabled={ask.isPending}
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400 transition hover:border-accent/40 hover:text-accent-soft disabled:opacity-40"
            >
              {s}
            </button>
          ))}
        </div>
      </GlassCard>

      {/* History drawer */}
      <AnimatePresence>
        {showHistory && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <GlassCard>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Previous consultations</p>
              {historyData?.queries.length ? (
                <div className="max-h-64 space-y-1 overflow-y-auto scrollbar-slim">
                  {historyData.queries.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => {
                        setCurrent(h);
                        setShowHistory(false);
                      }}
                      className="block w-full rounded-lg px-3 py-2 text-left transition hover:bg-white/[0.05]"
                    >
                      <p className="truncate text-sm text-slate-200">{h.question}</p>
                      <p className="text-[11px] text-slate-500">
                        {new Date(h.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} · {h.response.recommendation.action}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No consultations yet.</p>
              )}
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Thinking state */}
      {ask.isPending && (
        <GlassCard>
          <div className="flex items-center gap-3 text-sm text-slate-300">
            <SparklesIcon className="h-5 w-5 animate-pulse text-accent" />
            Gathering your profile, live quotes, fundamentals and technicals…
          </div>
          <div className="mt-4 space-y-2.5">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-24 w-full" />
          </div>
        </GlassCard>
      )}

      {/* Result */}
      <AnimatePresence mode="wait">
        {current && !ask.isPending && (
          <motion.div key={current.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <p className="mb-3 text-sm text-slate-400">
              <span className="text-slate-500">You asked: </span>
              <span className="font-medium text-slate-200">“{current.question}”</span>
            </p>
            <AdvisorResponseView response={current.response} meta={current.meta} />
          </motion.div>
        )}
      </AnimatePresence>

      {!current && !ask.isPending && (
        <GlassCard className="py-10 text-center">
          <SparklesIcon className="mx-auto h-8 w-8 text-accent/60" />
          <p className="mt-3 font-semibold text-slate-200">Ask your first question</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">
            Every answer follows a 12-section advisory format: summary, reasoning, allocation, risks, technicals, alternatives and concrete next steps.
          </p>
        </GlassCard>
      )}
    </div>
  );
}

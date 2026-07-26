import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { BeakerIcon } from '@heroicons/react/24/outline';
import { formatINR, RISK_BAND_LABELS, type MonteCarloResult, type RiskBand } from '@seeker/shared';
import { api, ApiError } from '@/lib/api';
import { GlassCard, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/input';
import { SectionHeader } from '@/components/ui/misc';
import { toast } from '@/components/ui/toast';
import { MoneyInput } from '@/features/onboarding/bits';
import { MonteCarloChart } from '@/features/portfolio/PortfolioPage';

interface SimulationResult {
  riskBand: RiskBand;
  assumedCagrPct: number;
  assumedVolPct: number;
  scenarios: Array<{
    name: string;
    shockPct: number;
    historicalExample: string;
    valueAfter: number;
    estRecoveryMonths: number;
  }>;
  monteCarlo: MonteCarloResult;
}

export default function RiskLabPage() {
  const [amount, setAmount] = useState(1_000_000);
  const [years, setYears] = useState(10);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const simulate = useMutation({
    mutationFn: () => api.post<SimulationResult>('/portfolio/simulate-risk', { amount, years }),
    onSuccess: setResult,
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Simulation failed'),
  });

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Risk Lab"
        subtitle="Stress-test an investment against historical-style crashes and a 1,000-path Monte Carlo simulation"
      />

      <GlassCard>
        <div className="grid items-end gap-4 sm:grid-cols-3">
          <Field label="Amount to stress-test">
            <MoneyInput value={amount} onChange={setAmount} />
          </Field>
          <Field label={`Horizon: ${years} years`}>
            <input
              type="range" min={1} max={30} value={years}
              onChange={(e) => setYears(Number(e.target.value))}
              className="w-full accent-emerald-400" aria-label="Simulation horizon"
            />
          </Field>
          <Button onClick={() => simulate.mutate()} loading={simulate.isPending}>
            <BeakerIcon className="h-4 w-4" /> Run simulation
          </Button>
        </div>
      </GlassCard>

      {result && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <p className="text-sm text-slate-400">
            Simulated at your <span className="font-semibold text-slate-200">{RISK_BAND_LABELS[result.riskBand]}</span> profile:{' '}
            {result.assumedCagrPct}% expected CAGR, {result.assumedVolPct}% volatility.
          </p>

          {/* Crash scenarios */}
          <div className="grid gap-4 sm:grid-cols-3">
            {result.scenarios.map((s) => (
              <GlassCard key={s.name}>
                <p className="text-sm font-bold text-white">{s.name}</p>
                <p className="text-[11px] text-slate-500">{s.historicalExample}</p>
                <p className="mt-3 text-2xl font-bold text-red-300">{formatINR(s.valueAfter, { compact: true })}</p>
                <p className="text-xs text-slate-400">value after shock (from {formatINR(amount, { compact: true })})</p>
                <p className="mt-3 border-t border-white/[0.06] pt-2.5 text-xs text-slate-300">
                  Est. recovery: <span className="font-semibold text-white">{s.estRecoveryMonths} months</span>
                  <span className="text-slate-500"> at {result.assumedCagrPct}% CAGR</span>
                </p>
              </GlassCard>
            ))}
          </div>

          <GlassCard>
            <CardTitle>Monte Carlo distribution</CardTitle>
            <MonteCarloChart mc={result.monteCarlo} />
          </GlassCard>

          <p className="glass-inset px-4 py-3.5 text-xs leading-relaxed text-slate-400">
            The lesson from every historical crash: investors who held (or bought) through the drawdown recovered;
            those who sold at the bottom locked the loss in permanently. Size positions so a −40% year is survivable —
            emotionally and financially.
          </p>
        </motion.div>
      )}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  DEFAULT_INFLATION_PCT, formatINR, inflate, lumpSumFutureValue,
  sipFutureValue, sipRequiredForTarget,
} from '@seeker/shared';
import { GlassCard, CardTitle } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { SectionHeader } from '@/components/ui/misc';
import { MoneyInput } from '@/features/onboarding/bits';
import { inrTooltip, LegendRow, ChartCaption } from '@/components/charts/ChartBits';
import { CHART } from '@/lib/utils';
import { cn } from '@/lib/utils';

type Tab = 'sip' | 'retirement' | 'emergency' | 'goal' | 'inflation';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'sip', label: 'SIP' },
  { key: 'retirement', label: 'Retirement' },
  { key: 'emergency', label: 'Emergency fund' },
  { key: 'goal', label: 'Goal planner' },
  { key: 'inflation', label: 'Inflation impact' },
];

export default function CalculatorsPage() {
  const [tab, setTab] = useState<Tab>('sip');
  return (
    <div className="space-y-6">
      <SectionHeader title="Financial Calculators" subtitle="Plan with real numbers — SIPs, retirement corpus, emergency cover, goals and inflation" />
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'rounded-xl px-4 py-2 text-sm font-medium transition',
              tab === t.key ? 'bg-accent/15 text-accent-soft shadow-glow' : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-200',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'sip' && <SipCalculator />}
      {tab === 'retirement' && <RetirementCalculator />}
      {tab === 'emergency' && <EmergencyCalculator />}
      {tab === 'goal' && <GoalPlanner />}
      {tab === 'inflation' && <InflationCalculator />}
    </div>
  );
}

function NumberField({ label, value, onChange, suffix, min = 0, max = 100, step = 0.5 }: {
  label: string; value: number; onChange: (v: number) => void; suffix?: string; min?: number; max?: number; step?: number;
}) {
  return (
    <Field label={label + (suffix ? ` (${suffix})` : '')}>
      <Input type="number" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </Field>
  );
}

function ResultTiles({ tiles }: { tiles: Array<[string, string, string?]> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {tiles.map(([k, v, sub]) => (
        <div key={k} className="glass-inset px-4 py-3.5">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">{k}</p>
          <p className="mt-1 text-xl font-bold text-white">{v}</p>
          {sub && <p className="text-[11px] text-slate-500">{sub}</p>}
        </div>
      ))}
    </div>
  );
}

function GrowthChart({ data, series }: {
  data: Array<Record<string, number | string>>;
  series: Array<{ key: string; label: string; color: string; dashed?: boolean }>;
}) {
  return (
    <>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <defs>
              {series.map((s) => (
                <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis dataKey="year" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={60} tickFormatter={(v: number) => formatINR(v, { compact: true }).replace('₹', '')} />
            <Tooltip content={inrTooltip} />
            {series.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                strokeDasharray={s.dashed ? '4 4' : undefined}
                fill={s.dashed ? 'transparent' : `url(#grad-${s.key})`}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <LegendRow items={series.map((s) => ({ label: s.label, color: s.color }))} />
    </>
  );
}

/* ── SIP ───────────────────────────────────────────────────── */
function SipCalculator() {
  const [monthly, setMonthly] = useState(25_000);
  const [rate, setRate] = useState(12);
  const [years, setYears] = useState(15);
  const [stepUp, setStepUp] = useState(10);

  const { data, fv, invested, stepUpFv } = useMemo(() => {
    const rows: Array<Record<string, number | string>> = [];
    let stepMonthly = monthly;
    let stepValue = 0;
    let flatInvested = 0;
    let stepInvested = 0;
    const monthlyRate = rate / 100 / 12;
    let flatValue = 0;
    for (let y = 1; y <= years; y++) {
      for (let m = 0; m < 12; m++) {
        flatValue = flatValue * (1 + monthlyRate) + monthly;
        stepValue = stepValue * (1 + monthlyRate) + stepMonthly;
        flatInvested += monthly;
        stepInvested += stepMonthly;
      }
      rows.push({ year: `Y${y}`, value: Math.round(flatValue), stepped: Math.round(stepValue), invested: Math.round(flatInvested) });
      stepMonthly = Math.round(stepMonthly * (1 + stepUp / 100));
    }
    return { data: rows, fv: flatValue, invested: flatInvested, stepUpFv: stepValue, stepUpInvested: stepInvested };
  }, [monthly, rate, years, stepUp]);

  return (
    <GlassCard>
      <CardTitle>SIP calculator</CardTitle>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Monthly SIP"><MoneyInput value={monthly} onChange={setMonthly} /></Field>
        <NumberField label="Expected return" suffix="% p.a." value={rate} onChange={setRate} max={30} />
        <NumberField label="Years" value={years} onChange={setYears} min={1} max={40} step={1} />
        <NumberField label="Annual step-up" suffix="%" value={stepUp} onChange={setStepUp} max={25} step={1} />
      </div>
      <div className="mt-5 space-y-5">
        <ResultTiles
          tiles={[
            ['Future value', formatINR(fv, { compact: true }), `${formatINR(invested, { compact: true })} invested`],
            ['Wealth gained', formatINR(fv - invested, { compact: true }), `${((fv / Math.max(invested, 1) - 1) * 100).toFixed(0)}% growth`],
            [`With ${stepUp}% step-up`, formatINR(stepUpFv, { compact: true }), `+${formatINR(stepUpFv - fv, { compact: true })} vs flat SIP`],
          ]}
        />
        <GrowthChart
          data={data}
          series={[
            { key: 'stepped', label: `Step-up SIP (${stepUp}%/yr)`, color: 'var(--series-5)' },
            { key: 'value', label: 'Flat SIP', color: CHART.primary },
            { key: 'invested', label: 'Invested', color: 'var(--text-muted)', dashed: true },
          ]}
        />
        <ChartCaption>Compounded monthly at {rate}% p.a. Estimates for planning, not guarantees.</ChartCaption>
      </div>
    </GlassCard>
  );
}

/* ── Retirement ────────────────────────────────────────────── */
function RetirementCalculator() {
  const [age, setAge] = useState(30);
  const [retireAge, setRetireAge] = useState(60);
  const [monthlyExpense, setMonthlyExpense] = useState(60_000);
  const [inflation, setInflation] = useState(DEFAULT_INFLATION_PCT);
  const [preReturn, setPreReturn] = useState(12);
  const [postReturn, setPostReturn] = useState(8);
  const [lifeExpectancy, setLifeExpectancy] = useState(85);
  const [existing, setExisting] = useState(500_000);

  const result = useMemo(() => {
    const yearsToRetire = Math.max(1, retireAge - age);
    const retirementYears = Math.max(1, lifeExpectancy - retireAge);
    const expenseAtRetirement = inflate(monthlyExpense, inflation, yearsToRetire);
    // Corpus via real-return annuity for inflation-adjusted withdrawals
    const realMonthly = (1 + postReturn / 100) / (1 + inflation / 100) - 1;
    const n = retirementYears * 12;
    const monthlyReal = realMonthly / 12 * 12; // annual real → monthly approx
    const r = Math.pow(1 + realMonthly, 1 / 12) - 1;
    const corpusNeeded = r > 0
      ? expenseAtRetirement * ((1 - Math.pow(1 + r, -n)) / r)
      : expenseAtRetirement * n;
    const existingFv = lumpSumFutureValue(existing, preReturn, yearsToRetire);
    const gap = Math.max(0, corpusNeeded - existingFv);
    const sipNeeded = sipRequiredForTarget(gap, preReturn, yearsToRetire);
    const rows: Array<Record<string, number | string>> = [];
    for (let y = 1; y <= yearsToRetire; y++) {
      rows.push({
        year: `${age + y}`,
        corpus: Math.round(lumpSumFutureValue(existing, preReturn, y) + sipFutureValue(sipNeeded, preReturn, y)),
        target: Math.round(corpusNeeded),
      });
    }
    return { corpusNeeded, expenseAtRetirement, sipNeeded, existingFv, gap, rows, monthlyReal };
  }, [age, retireAge, monthlyExpense, inflation, preReturn, postReturn, lifeExpectancy, existing]);

  return (
    <GlassCard>
      <CardTitle>Retirement calculator</CardTitle>
      <div className="grid gap-4 sm:grid-cols-4">
        <NumberField label="Current age" value={age} onChange={setAge} min={18} max={70} step={1} />
        <NumberField label="Retirement age" value={retireAge} onChange={setRetireAge} min={40} max={75} step={1} />
        <NumberField label="Life expectancy" value={lifeExpectancy} onChange={setLifeExpectancy} min={65} max={100} step={1} />
        <Field label="Monthly expenses today"><MoneyInput value={monthlyExpense} onChange={setMonthlyExpense} /></Field>
        <NumberField label="Inflation" suffix="%" value={inflation} onChange={setInflation} max={12} />
        <NumberField label="Return before retirement" suffix="%" value={preReturn} onChange={setPreReturn} max={20} />
        <NumberField label="Return after retirement" suffix="%" value={postReturn} onChange={setPostReturn} max={15} />
        <Field label="Existing retirement corpus"><MoneyInput value={existing} onChange={setExisting} /></Field>
      </div>
      <div className="mt-5 space-y-5">
        <ResultTiles
          tiles={[
            ['Corpus needed', formatINR(result.corpusNeeded, { compact: true }), `at age ${retireAge}`],
            ['Monthly expense then', formatINR(result.expenseAtRetirement, { compact: true }), `today's ${formatINR(monthlyExpense, { compact: true })} inflated`],
            ['SIP required', `${formatINR(result.sipNeeded, { compact: true })}/mo`, `existing corpus grows to ${formatINR(result.existingFv, { compact: true })}`],
          ]}
        />
        <GrowthChart
          data={result.rows}
          series={[
            { key: 'corpus', label: 'Projected corpus', color: CHART.primary },
            { key: 'target', label: 'Corpus needed', color: 'var(--series-6)', dashed: true },
          ]}
        />
        <ChartCaption>
          Corpus sized so inflation-adjusted withdrawals last until age {lifeExpectancy} at {postReturn}% post-retirement returns.
        </ChartCaption>
      </div>
    </GlassCard>
  );
}

/* ── Emergency fund ────────────────────────────────────────── */
function EmergencyCalculator() {
  const [expenses, setExpenses] = useState(50_000);
  const [emi, setEmi] = useState(10_000);
  const [current, setCurrent] = useState(100_000);
  const [monthlySaving, setMonthlySaving] = useState(20_000);
  const [months, setMonths] = useState(6);

  const target = (expenses + emi) * months;
  const gap = Math.max(0, target - current);
  const monthsToTarget = monthlySaving > 0 ? Math.ceil(gap / monthlySaving) : Infinity;
  const covered = expenses + emi > 0 ? current / (expenses + emi) : 0;

  return (
    <GlassCard>
      <CardTitle>Emergency fund calculator</CardTitle>
      <div className="grid gap-4 sm:grid-cols-5">
        <Field label="Monthly expenses"><MoneyInput value={expenses} onChange={setExpenses} /></Field>
        <Field label="Monthly EMIs"><MoneyInput value={emi} onChange={setEmi} /></Field>
        <Field label="Current emergency savings"><MoneyInput value={current} onChange={setCurrent} /></Field>
        <Field label="You can save per month"><MoneyInput value={monthlySaving} onChange={setMonthlySaving} /></Field>
        <NumberField label="Cover target" suffix="months" value={months} onChange={setMonths} min={3} max={12} step={1} />
      </div>
      <div className="mt-5 space-y-4">
        <ResultTiles
          tiles={[
            ['Target fund', formatINR(target, { compact: true }), `${months} months of outflows`],
            ['Current cover', `${covered.toFixed(1)} months`, covered >= months ? 'target met 🎉' : `${formatINR(gap, { compact: true })} short`],
            ['Time to target', Number.isFinite(monthsToTarget) ? (gap === 0 ? 'Done' : `${monthsToTarget} months`) : '—', `saving ${formatINR(monthlySaving, { compact: true })}/mo`],
          ]}
        />
        <p className="glass-inset px-4 py-3 text-xs leading-relaxed text-slate-400">
          Park the emergency fund in a liquid fund or sweep-in FD — instant access matters more than returns here.
          Only after {months} months of cover is secured should surplus flow to equity.
        </p>
      </div>
    </GlassCard>
  );
}

/* ── Goal planner ──────────────────────────────────────────── */
function GoalPlanner() {
  const [target, setTarget] = useState(2_000_000);
  const [years, setYears] = useState(5);
  const [rate, setRate] = useState(11);
  const [inflation, setInflation] = useState(DEFAULT_INFLATION_PCT);
  const [existing, setExisting] = useState(0);

  const inflatedTarget = inflate(target, inflation, years);
  const existingFv = lumpSumFutureValue(existing, rate, years);
  const gap = Math.max(0, inflatedTarget - existingFv);
  const sip = sipRequiredForTarget(gap, rate, years);

  const rows = useMemo(() => {
    const out: Array<Record<string, number | string>> = [];
    for (let y = 1; y <= years; y++) {
      out.push({
        year: `Y${y}`,
        projected: Math.round(lumpSumFutureValue(existing, rate, y) + sipFutureValue(sip, rate, y)),
        target: Math.round(inflate(target, inflation, y)),
      });
    }
    return out;
  }, [target, years, rate, inflation, existing, sip]);

  return (
    <GlassCard>
      <CardTitle>Goal planner</CardTitle>
      <div className="grid gap-4 sm:grid-cols-5">
        <Field label="Goal cost today"><MoneyInput value={target} onChange={setTarget} /></Field>
        <NumberField label="Years to goal" value={years} onChange={setYears} min={1} max={40} step={1} />
        <NumberField label="Expected return" suffix="%" value={rate} onChange={setRate} max={20} />
        <NumberField label="Inflation" suffix="%" value={inflation} onChange={setInflation} max={12} />
        <Field label="Already saved for this"><MoneyInput value={existing} onChange={setExisting} /></Field>
      </div>
      <div className="mt-5 space-y-5">
        <ResultTiles
          tiles={[
            ['Future cost', formatINR(inflatedTarget, { compact: true }), `${inflation}% inflation over ${years}y`],
            ['SIP needed', `${formatINR(sip, { compact: true })}/mo`, gap === 0 ? 'already funded' : `${formatINR(gap, { compact: true })} to build`],
            ['Existing savings grow to', formatINR(existingFv, { compact: true }), `at ${rate}% p.a.`],
          ]}
        />
        <GrowthChart
          data={rows}
          series={[
            { key: 'projected', label: 'Projected savings', color: 'var(--series-5)' },
            { key: 'target', label: 'Goal cost (inflating)', color: 'var(--series-6)', dashed: true },
          ]}
        />
        <ChartCaption>Match the horizon to the asset: goals under 3 years belong in debt, not equity.</ChartCaption>
      </div>
    </GlassCard>
  );
}

/* ── Inflation ─────────────────────────────────────────────── */
function InflationCalculator() {
  const [amount, setAmount] = useState(1_000_000);
  const [inflation, setInflation] = useState(DEFAULT_INFLATION_PCT);
  const [years, setYears] = useState(20);

  const futureValueNeeded = inflate(amount, inflation, years);
  const purchasingPower = amount / Math.pow(1 + inflation / 100, years);
  const rows = useMemo(() => {
    const out: Array<Record<string, number | string>> = [];
    for (let y = 0; y <= years; y += Math.max(1, Math.floor(years / 20))) {
      out.push({
        year: `Y${y}`,
        power: Math.round(amount / Math.pow(1 + inflation / 100, y)),
        cost: Math.round(inflate(amount, inflation, y)),
      });
    }
    return out;
  }, [amount, inflation, years]);

  return (
    <GlassCard>
      <CardTitle>Inflation impact</CardTitle>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Amount"><MoneyInput value={amount} onChange={setAmount} /></Field>
        <NumberField label="Inflation" suffix="%" value={inflation} onChange={setInflation} max={12} />
        <NumberField label="Years" value={years} onChange={setYears} min={1} max={50} step={1} />
      </div>
      <div className="mt-5 space-y-5">
        <ResultTiles
          tiles={[
            [`Today's ${formatINR(amount, { compact: true })} will feel like`, formatINR(purchasingPower, { compact: true }), `in ${years} years`],
            [`What costs ${formatINR(amount, { compact: true })} today will cost`, formatINR(futureValueNeeded, { compact: true }), `in ${years} years`],
            ['Required return just to stay flat', `${inflation}% p.a.`, 'anything below this loses purchasing power'],
          ]}
        />
        <GrowthChart
          data={rows}
          series={[
            { key: 'cost', label: 'Future cost of the same basket', color: 'var(--series-6)' },
            { key: 'power', label: "Purchasing power of today's money", color: CHART.primary },
          ]}
        />
        <ChartCaption>Why FDs alone rarely build wealth: post-tax FD returns hover near inflation.</ChartCaption>
      </div>
    </GlassCard>
  );
}

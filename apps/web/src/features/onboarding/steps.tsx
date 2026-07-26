import {
  CAPITAL_GAIN_PREFS,
  EMPLOYMENT_TYPES,
  GENDERS,
  GOAL_TYPES,
  HORIZONS,
  HORIZON_LABELS,
  INCOME_STABILITY,
  INVESTING_STYLES,
  MARKET_CAP_PREFS,
  RISK_QUESTIONS,
  SECTORS,
  SECTOR_LABELS,
  TAX_SLABS,
  formatINR,
  type GoalType,
  type InvestmentGoalInput,
  type OnboardingInput,
  type Sector,
} from '@seeker/shared';
import { TrashIcon } from '@heroicons/react/24/outline';
import { Input, Field, Select } from '@/components/ui/input';
import { Chip } from '@/components/ui/misc';
import { MoneyInput, MultiChips, OptionGrid, StepBlock, pretty } from './bits';

export interface StepProps {
  draft: OnboardingInput;
  update: (patch: Partial<OnboardingInput>) => void;
  errors: Record<string, string>;
}

/* ── Step 1 — Personal ─────────────────────────────────────── */
export function Step1Personal({ draft, update, errors }: StepProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Age" error={errors['age']}>
          <Input
            type="number"
            min={16}
            max={100}
            value={draft.age || ''}
            onChange={(e) => update({ age: Number(e.target.value) || 0 })}
          />
        </Field>
        <Field label="City" error={errors['city']}>
          <Input placeholder="Mumbai, Bengaluru…" value={draft.city} onChange={(e) => update({ city: e.target.value })} />
        </Field>
      </div>
      <StepBlock title="Gender">
        <OptionGrid options={GENDERS} value={draft.gender} onChange={(gender) => update({ gender })} columns={4}
          labels={{ PREFER_NOT_TO_SAY: 'Prefer not to say' }} />
      </StepBlock>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Occupation" error={errors['occupation']}>
          <Input placeholder="Software engineer, doctor, founder…" value={draft.occupation} onChange={(e) => update({ occupation: e.target.value })} />
        </Field>
        <Field label="Dependents" hint="People financially dependent on you">
          <Input type="number" min={0} max={12} placeholder="0" value={draft.dependents || ''} onChange={(e) => update({ dependents: Math.min(12, Math.max(0, Number(e.target.value) || 0)) })} />
        </Field>
      </div>
      <StepBlock title="Employment type">
        <OptionGrid options={EMPLOYMENT_TYPES} value={draft.employmentType} onChange={(employmentType) => update({ employmentType })} columns={3} />
      </StepBlock>
    </div>
  );
}

/* ── Step 2 — Income ───────────────────────────────────────── */
export function Step2Income({ draft, update, errors }: StepProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Monthly income (in-hand)" error={errors['monthlyIncome']}>
          <MoneyInput value={draft.monthlyIncome} onChange={(v) => update({ monthlyIncome: v, annualIncome: draft.annualIncome || v * 12 })} />
        </Field>
        <Field label="Annual income (CTC)" error={errors['annualIncome']}>
          <MoneyInput value={draft.annualIncome} onChange={(annualIncome) => update({ annualIncome })} />
        </Field>
      </div>
      <StepBlock title="How stable is your income?">
        <OptionGrid
          options={INCOME_STABILITY}
          value={draft.incomeStability}
          onChange={(incomeStability) => update({ incomeStability })}
          columns={4}
          labels={{ VERY_STABLE: 'Very stable', STABLE: 'Stable', VARIABLE: 'Variable', UNSTABLE: 'Unstable' }}
        />
      </StepBlock>
      <StepBlock title={`Expected salary growth: ${draft.expectedSalaryGrowthPct}% per year`}>
        <input
          type="range"
          min={0}
          max={30}
          step={1}
          value={draft.expectedSalaryGrowthPct}
          onChange={(e) => update({ expectedSalaryGrowthPct: Number(e.target.value) })}
          className="w-full accent-emerald-400"
          aria-label="Expected salary growth percentage"
        />
        <div className="flex justify-between text-[11px] text-slate-500">
          <span>0%</span><span>15%</span><span>30%</span>
        </div>
      </StepBlock>
    </div>
  );
}

/* ── Step 3 — Financial situation ──────────────────────────── */
const INVESTMENT_FIELDS: Array<{ key: keyof OnboardingInput['existingInvestments']; label: string }> = [
  { key: 'fd', label: 'Fixed Deposits' },
  { key: 'mutualFunds', label: 'Mutual Funds' },
  { key: 'stocks', label: 'Stocks' },
  { key: 'gold', label: 'Gold' },
  { key: 'crypto', label: 'Crypto' },
  { key: 'realEstate', label: 'Real Estate' },
  { key: 'ppf', label: 'PPF' },
  { key: 'epf', label: 'EPF' },
];

export function Step3Financial({ draft, update, errors }: StepProps) {
  const inv = draft.existingInvestments;
  const totalInv = Object.values(inv).reduce((a, b) => a + b, 0);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Current savings (bank balance)" error={errors['currentSavings']}>
          <MoneyInput value={draft.currentSavings} onChange={(currentSavings) => update({ currentSavings })} />
        </Field>
        <Field label="Emergency fund" hint="Money you can access within 48 hours">
          <MoneyInput value={draft.emergencyFund} onChange={(emergencyFund) => update({ emergencyFund })} />
        </Field>
        <Field label="Monthly expenses" error={errors['monthlyExpenses']}>
          <MoneyInput value={draft.monthlyExpenses} onChange={(monthlyExpenses) => update({ monthlyExpenses })} />
        </Field>
        <Field label="Monthly EMIs" hint="Loans, credit card payments">
          <MoneyInput value={draft.monthlyEmi} onChange={(monthlyEmi) => update({ monthlyEmi })} />
        </Field>
      </div>
      <StepBlock title="Current investments" hint={totalInv > 0 ? `Total: ${formatINR(totalInv, { compact: true })}` : 'Enter what you already hold (leave 0 if none)'}>
        <div className="grid gap-3 sm:grid-cols-2">
          {INVESTMENT_FIELDS.map(({ key, label }) => (
            <Field key={key} label={label}>
              <MoneyInput
                value={inv[key]}
                onChange={(v) => update({ existingInvestments: { ...inv, [key]: v } })}
              />
            </Field>
          ))}
        </div>
      </StepBlock>
    </div>
  );
}

/* ── Step 4 — Goals ────────────────────────────────────────── */
const GOAL_EMOJI: Record<GoalType, string> = {
  RETIREMENT: '🌅', HOUSE: '🏠', CAR: '🚗', MARRIAGE: '💍', CHILD_EDUCATION: '🎓',
  VACATION: '✈️', WEALTH_CREATION: '📈', PASSIVE_INCOME: '💸', FINANCIAL_FREEDOM: '🕊️', CUSTOM: '✨',
};

export function Step4Goals({ draft, update, errors }: StepProps) {
  const addGoal = (type: GoalType) => {
    if (draft.goals.some((g) => g.type === type && type !== 'CUSTOM')) return;
    const goal: InvestmentGoalInput = {
      type,
      label: type === 'CUSTOM' ? '' : undefined,
      targetAmount: type === 'RETIREMENT' ? 30_000_000 : type === 'HOUSE' ? 5_000_000 : 1_000_000,
      targetYears: type === 'RETIREMENT' ? 25 : 5,
      priority: 2,
    };
    update({ goals: [...draft.goals, goal] });
  };
  const patchGoal = (i: number, patch: Partial<InvestmentGoalInput>) => {
    update({ goals: draft.goals.map((g, idx) => (idx === i ? { ...g, ...patch } : g)) });
  };
  const removeGoal = (i: number) => update({ goals: draft.goals.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-6">
      <StepBlock title="What are you investing for?" hint="Pick one or more — each gets its own plan">
        <div className="flex flex-wrap gap-2">
          {GOAL_TYPES.map((type) => (
            <Chip key={type} selected={draft.goals.some((g) => g.type === type)} onClick={() => addGoal(type)}>
              {GOAL_EMOJI[type]} {pretty(type)}
            </Chip>
          ))}
        </div>
        {errors['goals'] && <p className="text-xs text-status-serious">{errors['goals']}</p>}
      </StepBlock>

      {draft.goals.map((goal, i) => (
        <div key={`${goal.type}-${i}`} className="glass-inset space-y-4 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-200">
              {GOAL_EMOJI[goal.type]} {goal.type === 'CUSTOM' ? goal.label || 'Custom goal' : pretty(goal.type)}
            </p>
            <button onClick={() => removeGoal(i)} className="text-slate-500 hover:text-status-critical" aria-label="Remove goal">
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
          {goal.type === 'CUSTOM' && (
            <Field label="Goal name" error={errors[`goals.${i}.label`]}>
              <Input value={goal.label ?? ''} onChange={(e) => patchGoal(i, { label: e.target.value })} placeholder="e.g. Start a business" />
            </Field>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Target amount (today's cost)">
              <MoneyInput value={goal.targetAmount} onChange={(targetAmount) => patchGoal(i, { targetAmount })} />
            </Field>
            <Field label="Years to goal">
              <Input type="number" min={1} max={50} value={goal.targetYears} onChange={(e) => patchGoal(i, { targetYears: Number(e.target.value) || 1 })} />
            </Field>
            <Field label="Priority">
              <Select value={goal.priority} onChange={(e) => patchGoal(i, { priority: Number(e.target.value) as 1 | 2 | 3 })}>
                <option value={1}>High</option>
                <option value={2}>Medium</option>
                <option value={3}>Low</option>
              </Select>
            </Field>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Step 5 — Risk quiz ────────────────────────────────────── */
export function Step5Risk({ draft, update, errors }: StepProps) {
  const answered = Object.keys(draft.riskAnswers).length;
  return (
    <div className="space-y-7">
      <p className="text-sm text-slate-400">
        No boring "low / medium / high" question — react to real scenarios instead.{' '}
        <span className="text-slate-300">{answered}/{RISK_QUESTIONS.length} answered</span>
      </p>
      {errors['riskAnswers'] && <p className="text-xs text-status-serious">{errors['riskAnswers']}</p>}
      {RISK_QUESTIONS.map((q, qi) => (
        <StepBlock key={q.id} title={`${qi + 1}. ${q.question}`}>
          <div className="space-y-2">
            {q.options.map((opt) => {
              const selected = draft.riskAnswers[q.id] === opt.score;
              return (
                <button
                  key={opt.label}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => update({ riskAnswers: { ...draft.riskAnswers, [q.id]: opt.score } })}
                  className={`block w-full rounded-xl border px-4 py-2.5 text-left text-sm transition ${
                    selected
                      ? 'border-accent/60 bg-accent/12 text-accent-soft'
                      : 'border-white/[0.08] bg-white/[0.02] text-slate-300 hover:border-white/20 hover:bg-white/[0.05]'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </StepBlock>
      ))}
    </div>
  );
}

/* ── Step 6 — Horizon ──────────────────────────────────────── */
export function Step6Horizon({ draft, update }: StepProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">When will you actually need most of this money back?</p>
      <div className="space-y-2.5">
        {HORIZONS.map((h) => (
          <button
            key={h}
            type="button"
            aria-pressed={draft.horizon === h}
            onClick={() => update({ horizon: h })}
            className={`flex w-full items-center justify-between rounded-xl border px-4 py-3.5 text-sm transition ${
              draft.horizon === h
                ? 'border-accent/60 bg-accent/12 text-white'
                : 'border-white/[0.08] bg-white/[0.02] text-slate-300 hover:border-white/20'
            }`}
          >
            <span className="font-medium">{HORIZON_LABELS[h]}</span>
            <span className="text-xs text-slate-500">
              {h === 'LT_1Y' && 'Capital safety only'}
              {h === 'Y1_3' && 'Debt-tilted, light equity'}
              {h === 'Y3_5' && 'Balanced equity'}
              {h === 'Y5_10' && 'Growth territory'}
              {h === 'GT_10Y' && 'Full compounding power'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Step 7 — Amounts ──────────────────────────────────────── */
export function Step7Amount({ draft, update, errors }: StepProps) {
  const surplus = draft.monthlyIncome - draft.monthlyExpenses - draft.monthlyEmi;
  return (
    <div className="space-y-5">
      {surplus > 0 && (
        <p className="glass-inset px-4 py-3 text-xs text-slate-400">
          Your estimated investable surplus is <span className="font-semibold text-accent-soft">{formatINR(surplus, { compact: true })}/month</span>.
          A common starting point is 40–60% of surplus as SIP.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Monthly SIP" error={errors['monthlySip']}>
          <MoneyInput value={draft.monthlySip} onChange={(monthlySip) => update({ monthlySip })} />
        </Field>
        <Field label="One-time (lump sum) available now">
          <MoneyInput value={draft.lumpSum} onChange={(lumpSum) => update({ lumpSum })} />
        </Field>
        <Field label="Additional annual investment" hint="Bonus, incentives you plan to invest">
          <MoneyInput value={draft.annualInvestment} onChange={(annualInvestment) => update({ annualInvestment })} />
        </Field>
        <Field label={`Max allocation to one stock: ${draft.maxSingleStockAllocationPct}%`} hint="Concentration guardrail — 25% is a sensible ceiling">
          <input
            type="range"
            min={5}
            max={50}
            step={5}
            value={draft.maxSingleStockAllocationPct}
            onChange={(e) => update({ maxSingleStockAllocationPct: Number(e.target.value) })}
            className="mt-3 w-full accent-emerald-400"
            aria-label="Maximum single stock allocation"
          />
        </Field>
      </div>
    </div>
  );
}

/* ── Step 8 — Preferences ──────────────────────────────────── */
export function Step8Preferences({ draft, update }: StepProps) {
  const toggle = <T extends string>(list: T[], v: T): T[] =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  return (
    <div className="space-y-7">
      <StepBlock title="Investing styles" hint="Pick any that resonate">
        <MultiChips
          options={INVESTING_STYLES}
          values={draft.styles}
          onToggle={(v) => update({ styles: toggle(draft.styles, v) })}
          labels={{ ESG: 'ESG / Sustainable', DIVIDEND: 'Dividend income', GROWTH: 'Growth', VALUE: 'Value', MOMENTUM: 'Momentum' }}
        />
      </StepBlock>
      <StepBlock title="Market-cap comfort" hint="Leave empty for no restriction">
        <MultiChips
          options={MARKET_CAP_PREFS}
          values={draft.marketCapPrefs}
          onToggle={(v) => update({ marketCapPrefs: toggle(draft.marketCapPrefs, v) })}
          labels={{ SMALL_CAP: 'Small cap', MID_CAP: 'Mid cap', LARGE_CAP: 'Large cap', BLUE_CHIP: 'Blue chip' }}
        />
      </StepBlock>
      <StepBlock title="Sectors you like">
        <MultiChips
          options={SECTORS}
          values={draft.preferredSectors}
          onToggle={(v) =>
            update({
              preferredSectors: toggle(draft.preferredSectors, v),
              avoidSectors: draft.avoidSectors.filter((s) => s !== v),
            })
          }
          labels={SECTOR_LABELS as Record<Sector, string>}
        />
      </StepBlock>
      <StepBlock title="Sectors to avoid" hint="e.g. on ethical grounds">
        <MultiChips
          options={SECTORS}
          values={draft.avoidSectors}
          onToggle={(v) =>
            update({
              avoidSectors: toggle(draft.avoidSectors, v),
              preferredSectors: draft.preferredSectors.filter((s) => s !== v),
            })
          }
          labels={SECTOR_LABELS as Record<Sector, string>}
        />
      </StepBlock>
    </div>
  );
}

/* ── Step 9 — Tax ──────────────────────────────────────────── */
export function Step9Tax({ draft, update }: StepProps) {
  return (
    <div className="space-y-7">
      <StepBlock title="Income-tax slab">
        <OptionGrid
          options={TAX_SLABS}
          value={draft.taxSlab}
          onChange={(taxSlab) => update({ taxSlab })}
          columns={3}
          labels={{ NONE: 'No tax', S5: '5%', S10: '10%', S15: '15%', S20: '20%', S30: '30%' }}
        />
      </StepBlock>
      <StepBlock title={`Section 80C already used: ${formatINR(draft.used80cAmount, { compact: true })} / ₹1.5L`} hint="EPF, ELSS, PPF, life insurance premiums…">
        <input
          type="range"
          min={0}
          max={150_000}
          step={10_000}
          value={draft.used80cAmount}
          onChange={(e) => update({ used80cAmount: Number(e.target.value) })}
          className="w-full accent-emerald-400"
          aria-label="80C amount used"
        />
        <div className="flex justify-between text-[11px] text-slate-500">
          <span>₹0</span><span>₹75K</span><span>₹1.5L</span>
        </div>
      </StepBlock>
      <StepBlock title="Capital gains preference">
        <OptionGrid
          options={CAPITAL_GAIN_PREFS}
          value={draft.capitalGainPref}
          onChange={(capitalGainPref) => update({ capitalGainPref })}
          columns={3}
          labels={{
            LONG_TERM: 'Long term (12.5% above ₹1.25L)',
            SHORT_TERM: 'Short term (20%)',
            BALANCED: 'Balanced',
          }}
        />
      </StepBlock>
    </div>
  );
}

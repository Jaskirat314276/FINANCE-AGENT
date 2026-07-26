import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { OnboardingInput } from '@seeker/shared';

/** Draft persists locally so an interrupted onboarding resumes in place. */

export const DEFAULT_DRAFT: OnboardingInput = {
  age: 25,
  gender: 'PREFER_NOT_TO_SAY',
  occupation: '',
  city: '',
  employmentType: 'PRIVATE',
  dependents: 0,
  monthlyIncome: 0,
  annualIncome: 0,
  incomeStability: 'STABLE',
  expectedSalaryGrowthPct: 8,
  currentSavings: 0,
  emergencyFund: 0,
  monthlyExpenses: 0,
  monthlyEmi: 0,
  existingInvestments: { fd: 0, mutualFunds: 0, stocks: 0, gold: 0, crypto: 0, realEstate: 0, ppf: 0, epf: 0 },
  goals: [],
  riskAnswers: {},
  horizon: 'Y5_10',
  monthlySip: 0,
  lumpSum: 0,
  annualInvestment: 0,
  maxSingleStockAllocationPct: 25,
  styles: [],
  marketCapPrefs: [],
  preferredSectors: [],
  avoidSectors: [],
  taxSlab: 'S20',
  used80cAmount: 0,
  capitalGainPref: 'LONG_TERM',
};

interface OnboardingState {
  step: number;
  draft: OnboardingInput;
  setStep: (step: number) => void;
  update: (patch: Partial<OnboardingInput>) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      step: 1,
      draft: DEFAULT_DRAFT,
      setStep: (step) => set({ step }),
      update: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
      reset: () => set({ step: 1, draft: DEFAULT_DRAFT }),
    }),
    { name: 'seeker-onboarding-draft' },
  ),
);

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon } from '@heroicons/react/24/outline';
import { ONBOARDING_STEP_SCHEMAS, RISK_QUESTIONS, type FinancialProfile } from '@seeker/shared';
import { api, ApiError } from '@/lib/api';
import { Logo } from '@/components/layout/Logo';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { useAuthStore } from '@/stores/auth.store';
import { useOnboardingStore } from './store';
import {
  Step1Personal, Step2Income, Step3Financial, Step4Goals, Step5Risk,
  Step6Horizon, Step7Amount, Step8Preferences, Step9Tax, type StepProps,
} from './steps';

const STEPS: Array<{ title: string; subtitle: string; component: (p: StepProps) => JSX.Element }> = [
  { title: 'About you', subtitle: 'The basics that anchor every recommendation', component: Step1Personal },
  { title: 'Income', subtitle: 'What comes in, and how reliably', component: Step2Income },
  { title: 'Financial situation', subtitle: 'Savings, expenses and what you already own', component: Step3Financial },
  { title: 'Goals', subtitle: 'What the money is actually for', component: Step4Goals },
  { title: 'Risk profile', subtitle: 'Scenario reactions — we compute the score', component: Step5Risk },
  { title: 'Time horizon', subtitle: 'When you need the money back', component: Step6Horizon },
  { title: 'Investment amounts', subtitle: 'SIP, lump sum and guardrails', component: Step7Amount },
  { title: 'Preferences', subtitle: 'Styles, market caps and sectors', component: Step8Preferences },
  { title: 'Tax', subtitle: 'So suggestions are tax-aware (80C, LTCG)', component: Step9Tax },
];

export default function OnboardingPage() {
  const { step, setStep, draft, update, reset } = useOnboardingStore();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const markOnboarded = useAuthStore((s) => s.markOnboarded);
  const navigate = useNavigate();

  const stepIndex = Math.min(Math.max(step, 1), 9);
  const { title, subtitle, component: StepComponent } = STEPS[stepIndex - 1]!;

  const validateCurrent = (): boolean => {
    const schema = ONBOARDING_STEP_SCHEMAS[stepIndex as keyof typeof ONBOARDING_STEP_SCHEMAS];
    const result = schema.safeParse(draft);
    if (result.success) {
      // Risk step needs all questions answered, not just a valid record
      if (stepIndex === 5 && Object.keys(draft.riskAnswers).length < RISK_QUESTIONS.length) {
        setErrors({ riskAnswers: 'Answer all scenarios so we can compute your risk score accurately.' });
        return false;
      }
      setErrors({});
      return true;
    }
    const map: Record<string, string> = {};
    for (const issue of result.error.issues) map[issue.path.join('.')] = issue.message;
    setErrors(map);
    return false;
  };

  const next = async () => {
    if (!validateCurrent()) return;
    if (stepIndex < 9) {
      setStep(stepIndex + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    // Final submit
    setSubmitting(true);
    try {
      const { profile } = await api.post<{ profile: FinancialProfile }>('/profile/onboarding', draft);
      markOnboarded();
      reset();
      toast.success(`Profile ready — risk score ${profile.riskScore}/100 (${profile.riskBand.toLowerCase().replace('_', ' ')})`);
      navigate('/app', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.issues?.length) {
        toast.error(`Check your inputs: ${err.issues[0]!.path} — ${err.issues[0]!.message}`);
      } else {
        toast.error(err instanceof ApiError ? err.message : 'Could not save your profile');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const progress = useMemo(() => ((stepIndex - 1) / 9) * 100, [stepIndex]);

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 py-8 sm:py-12">
      <div className="mb-8 flex items-center justify-between">
        <Logo />
        <span className="text-xs text-slate-500">Step {stepIndex} of 9</span>
      </div>

      {/* Progress rail */}
      <div className="mb-8">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-accent-deep to-accent"
            animate={{ width: `${progress + 100 / 9}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          />
        </div>
        <div className="mt-3 hidden justify-between sm:flex">
          {STEPS.map((s, i) => (
            <button
              key={s.title}
              onClick={() => i + 1 < stepIndex && setStep(i + 1)}
              className={`h-2 w-2 rounded-full transition ${
                i + 1 < stepIndex ? 'bg-accent' : i + 1 === stepIndex ? 'bg-accent/60 ring-4 ring-accent/15' : 'bg-white/15'
              }`}
              aria-label={`Step ${i + 1}: ${s.title}`}
              disabled={i + 1 >= stepIndex}
            />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={stepIndex}
          initial={{ opacity: 0, x: 32 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -32 }}
          transition={{ duration: 0.25 }}
          className="glass p-6 sm:p-8"
        >
          <h1 className="text-xl font-bold text-white">{title}</h1>
          <p className="mb-6 mt-1 text-sm text-slate-400">{subtitle}</p>
          <StepComponent draft={draft} update={update} errors={errors} />
        </motion.div>
      </AnimatePresence>

      <div className="mt-6 flex items-center justify-between">
        <Button variant="ghost" onClick={() => stepIndex > 1 && setStep(stepIndex - 1)} disabled={stepIndex === 1 || submitting}>
          <ArrowLeftIcon className="h-4 w-4" /> Back
        </Button>
        <Button onClick={next} loading={submitting} size="lg">
          {stepIndex === 9 ? (
            <>
              Build my profile <CheckIcon className="h-4 w-4" />
            </>
          ) : (
            <>
              Continue <ArrowRightIcon className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

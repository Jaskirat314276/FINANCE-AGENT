import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { loginSchema, signupSchema, type LoginInput, type SignupInput } from '@seeker/shared';
import { api, ApiError } from '@/lib/api';
import { Logo } from '@/components/layout/Logo';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { useAuthStore, type AuthUser } from '@/stores/auth.store';

interface AuthResponse {
  user: AuthUser;
  tokens: { accessToken: string; refreshToken: string };
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (r: { credential: string }) => void }) => void;
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
        };
      };
    };
  }
}

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: { pathname?: string } } };
  const setAuth = useAuthStore((s) => s.setAuth);
  const googleDiv = useRef<HTMLDivElement>(null);

  const { data: caps } = useQuery({
    queryKey: ['auth-capabilities'],
    queryFn: () => api.get<{ googleEnabled: boolean; googleClientId: string | null }>('/auth/capabilities', { auth: false }),
    staleTime: Infinity,
  });

  const onSuccess = (data: AuthResponse) => {
    setAuth(data.user, data.tokens);
    const target = data.user.onboarded ? (location.state?.from?.pathname ?? '/app') : '/onboarding';
    navigate(target, { replace: true });
  };

  // Google Identity Services (only when the server has a client id)
  useEffect(() => {
    const clientId = caps?.googleClientId ?? (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined);
    if (!caps?.googleEnabled || !clientId || !googleDiv.current) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      if (!window.google || !googleDiv.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          try {
            onSuccess(await api.post<AuthResponse>('/auth/google', { credential }, { auth: false }));
          } catch (err) {
            toast.error(err instanceof ApiError ? err.message : 'Google sign-in failed');
          }
        },
      });
      window.google.accounts.id.renderButton(googleDiv.current, {
        theme: 'filled_black',
        size: 'large',
        width: 340,
        shape: 'pill',
      });
    };
    document.head.appendChild(script);
    return () => script.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caps?.googleEnabled, caps?.googleClientId]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <Link to="/" className="inline-block">
            <Logo />
          </Link>
          <h1 className="mt-6 text-2xl font-bold text-white">
            {mode === 'signup' ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {mode === 'signup' ? 'Three minutes to a personalized investment plan.' : 'Sign in to continue to your dashboard.'}
          </p>
        </div>

        <div className="glass p-6 sm:p-8">
          {/* Mode switch */}
          <div className="mb-6 grid grid-cols-2 rounded-xl border border-white/10 bg-ink-900/60 p-1 text-sm font-medium">
            {(['signup', 'login'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-lg py-2 transition ${mode === m ? 'bg-white/[0.1] text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {m === 'signup' ? 'Sign up' : 'Log in'}
              </button>
            ))}
          </div>

          {mode === 'signup' ? <SignupForm onSuccess={onSuccess} /> : <LoginForm onSuccess={onSuccess} />}

          {caps?.googleEnabled && (
            <>
              <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-slate-500">
                <span className="h-px flex-1 bg-white/10" /> or <span className="h-px flex-1 bg-white/10" />
              </div>
              <div ref={googleDiv} className="flex justify-center" />
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Try the demo account — <span className="text-slate-300">demo@seeker.ai / SeekerDemo1</span> (after seeding)
        </p>
      </motion.div>
    </div>
  );
}

function SignupForm({ onSuccess }: { onSuccess: (d: AuthResponse) => void }) {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, watch, formState } = useForm<SignupInput>({ resolver: zodResolver(signupSchema) });
  const password = watch('password') ?? '';

  const submit = handleSubmit(async (values) => {
    setLoading(true);
    try {
      onSuccess(await api.post<AuthResponse>('/auth/signup', values, { auth: false }));
      toast.success('Account created — let’s build your profile');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not sign up');
    } finally {
      setLoading(false);
    }
  });

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Full name" error={formState.errors.name?.message}>
        <Input placeholder="Aarav Sharma" autoComplete="name" {...register('name')} />
      </Field>
      <Field label="Email" error={formState.errors.email?.message}>
        <Input type="email" placeholder="you@example.com" autoComplete="email" {...register('email')} />
      </Field>
      <Field label="Password" error={formState.errors.password?.message} hint="8+ characters with a letter and a number">
        <Input type="password" placeholder="••••••••" autoComplete="new-password" {...register('password')} />
        <PasswordStrength value={password} />
      </Field>
      <Button type="submit" className="w-full" loading={loading}>
        Create account
      </Button>
    </form>
  );
}

const PW_TIERS = [
  { label: 'Weak', color: '#d03b3b' }, // status.critical
  { label: 'Fair', color: '#fab219' }, // status.warning
  { label: 'Good', color: '#34d399' }, // accent
  { label: 'Strong', color: '#0ca30c' }, // status.good
] as const;

/** Heuristic password strength on a 1–4 scale (length + character variety). */
function evaluatePassword(pw: string): { level: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  // Anything under the 8-char minimum can never rank above "Weak".
  const level = pw.length < 8 ? 1 : Math.min(4, Math.max(1, score));
  return { level, ...PW_TIERS[level - 1]! };
}

/** Live strength meter shown while a new password is typed. */
function PasswordStrength({ value }: { value: string }) {
  const { level, label, color } = useMemo(() => evaluatePassword(value), [value]);
  if (!value) return null;
  return (
    <div aria-live="polite">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map((seg) => (
          <span
            key={seg}
            className="h-1.5 flex-1 rounded-full bg-white/10 transition-colors"
            style={seg <= level ? { backgroundColor: color } : undefined}
          />
        ))}
      </div>
      <p className="mt-1.5 text-xs text-slate-400">
        Password strength: <span className="font-medium" style={{ color }}>{label}</span>
      </p>
    </div>
  );
}

function LoginForm({ onSuccess }: { onSuccess: (d: AuthResponse) => void }) {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const submit = handleSubmit(async (values) => {
    setLoading(true);
    try {
      onSuccess(await api.post<AuthResponse>('/auth/login', values, { auth: false }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not log in');
    } finally {
      setLoading(false);
    }
  });

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Email" error={formState.errors.email?.message}>
        <Input type="email" placeholder="you@example.com" autoComplete="email" {...register('email')} />
      </Field>
      <Field label="Password" error={formState.errors.password?.message}>
        <Input type="password" placeholder="••••••••" autoComplete="current-password" {...register('password')} />
      </Field>
      <Button type="submit" className="w-full" loading={loading}>
        Sign in
      </Button>
    </form>
  );
}

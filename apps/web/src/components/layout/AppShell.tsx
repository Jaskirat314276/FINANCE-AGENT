import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ArrowRightStartOnRectangleIcon,
  Bars3Icon,
  BeakerIcon,
  ChartBarSquareIcon,
  ChatBubbleLeftRightIcon,
  CalculatorIcon,
  EyeIcon,
  HomeIcon,
  MagnifyingGlassIcon,
  NewspaperIcon,
  SparklesIcon,
  Squares2X2Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { SEBI_DISCLAIMER } from '@seeker/shared';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Logo } from './Logo';

const NAV = [
  { to: '/app', label: 'Dashboard', icon: HomeIcon, end: true },
  { to: '/app/advisor', label: 'AI Advisor', icon: SparklesIcon },
  { to: '/app/chat', label: 'Chat', icon: ChatBubbleLeftRightIcon },
  { to: '/app/stocks', label: 'Stocks', icon: MagnifyingGlassIcon },
  { to: '/app/portfolio', label: 'Portfolio', icon: ChartBarSquareIcon },
  { to: '/app/strategies', label: 'Strategies', icon: Squares2X2Icon },
  { to: '/app/watchlist', label: 'Watchlist', icon: EyeIcon },
  { to: '/app/insights', label: 'Insights', icon: NewspaperIcon },
  { to: '/app/tools', label: 'Calculators', icon: CalculatorIcon },
  { to: '/app/simulator', label: 'Risk Lab', icon: BeakerIcon },
];

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, refreshToken, clear } = useAuthStore();
  const navigate = useNavigate();

  const logout = async () => {
    api.post('/auth/logout', { refreshToken }).catch(() => undefined);
    clear();
    navigate('/');
  };

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto scrollbar-slim">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition',
              isActive
                ? 'bg-accent/12 text-accent-soft shadow-[inset_2px_0_0_0] shadow-accent'
                : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200',
            )
          }
        >
          <Icon className="h-5 w-5 shrink-0" />
          {label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col gap-6 border-r border-white/[0.06] bg-ink-950/60 p-4 backdrop-blur-xl lg:flex">
        <Logo className="px-2 pt-1" />
        {nav}
        <div className="space-y-3">
          <div className="glass-inset flex items-center gap-2.5 p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-series-1 text-xs font-bold text-ink-950">
              {user?.name?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-200">{user?.name}</p>
              <p className="truncate text-[11px] text-slate-500">{user?.email}</p>
            </div>
            <button onClick={logout} title="Sign out" className="text-slate-500 transition hover:text-slate-200">
              <ArrowRightStartOnRectangleIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-medium text-slate-500">Appearance</span>
            <ThemeToggle />
          </div>
          <p className="px-1 text-[9px] leading-relaxed text-slate-600">{SEBI_DISCLAIMER}</p>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-white/[0.06] bg-ink-950/80 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button onClick={() => setMobileOpen((v) => !v)} className="text-slate-300" aria-label="Toggle menu">
            {mobileOpen ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-ink-950/95 px-4 pb-8 pt-20 backdrop-blur-xl lg:hidden">
          {nav}
          <button onClick={logout} className="mt-6 flex items-center gap-2 px-3.5 text-sm text-slate-400">
            <ArrowRightStartOnRectangleIcon className="h-5 w-5" /> Sign out
          </button>
        </div>
      )}

      <main className="min-w-0 flex-1 px-4 pb-16 pt-20 sm:px-6 lg:ml-60 lg:px-10 lg:pt-8">
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

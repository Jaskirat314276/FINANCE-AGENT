import { MoonIcon, SunIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { useThemeStore } from '@/stores/theme.store';

/** Sun/Moon toggle for switching between light and dark themes. */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={!isDark}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08]',
        'bg-white/[0.04] text-slate-400 transition hover:bg-white/[0.08] hover:text-slate-100',
        'focus-visible:ring-2 focus-visible:ring-accent/70',
        className,
      )}
    >
      {isDark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
    </button>
  );
}

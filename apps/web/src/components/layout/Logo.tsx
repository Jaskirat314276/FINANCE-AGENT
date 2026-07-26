import { cn } from '@/lib/utils';

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex select-none items-center gap-2', className)}>
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden className="shrink-0">
        <defs>
          <linearGradient id="seeker-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#34d399" />
            <stop offset="1" stopColor="#3987e5" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="8" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.12)" />
        <path d="M7 21l5-6 4 3 6-8" stroke="url(#seeker-g)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <circle cx="22" cy="10" r="2.2" fill="#34d399" />
      </svg>
      {!compact && (
        <span className="text-lg font-bold tracking-tight text-white">
          Seeker <span className="text-gradient">AI</span>
        </span>
      )}
    </span>
  );
}

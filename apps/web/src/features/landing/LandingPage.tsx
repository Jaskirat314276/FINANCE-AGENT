import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRightIcon,
  ChartPieIcon,
  CpuChipIcon,
  FlagIcon,
  GlobeAsiaAustraliaIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { SEBI_DISCLAIMER } from '@seeker/shared';
import { Logo } from '@/components/layout/Logo';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth.store';

const FEATURES = [
  {
    icon: SparklesIcon,
    title: 'AI Investment Advisor',
    text: 'Ask anything — "Should I invest ₹50,000 today?" — and get a 12-section structured answer grounded in your profile and live NSE data, never generic tips.',
  },
  {
    icon: ChartPieIcon,
    title: 'Portfolio Planning',
    text: 'A quantitative engine builds allocations across stocks, ETFs, gold, debt and cash — with Monte Carlo projections and a rebalancing calendar.',
  },
  {
    icon: CpuChipIcon,
    title: 'Personalized Recommendations',
    text: 'Every suggestion is scored against your risk band, horizon, sector preferences and tax situation. Advice adapts as your profile evolves.',
  },
  {
    icon: GlobeAsiaAustraliaIcon,
    title: 'Indian Market Intelligence',
    text: 'Nifty, Sensex, Bank Nifty, sector heatmaps, top movers, fundamentals and technicals for NSE stocks — with AI daily commentary.',
  },
  {
    icon: FlagIcon,
    title: 'Goal Based Investing',
    text: 'House, retirement, education, freedom — each goal gets its own inflation-adjusted target, required SIP and progress tracking.',
  },
  {
    icon: ShieldCheckIcon,
    title: 'Risk, Measured Properly',
    text: 'No "low/medium/high" dropdowns. Scenario-based questions compute a real risk score from willingness and financial capacity.',
  },
];

const QUESTIONS = [
  'Should I invest ₹50,000 today?',
  'Build a ₹10 lakh portfolio',
  'Compare Infosys vs TCS',
  'Why is TCS falling?',
  'How much cash should I hold?',
  'Should I buy small caps now?',
];

export default function LandingPage() {
  const user = useAuthStore((s) => s.user);
  const cta = user ? (user.onboarded ? '/app' : '/onboarding') : '/auth';

  return (
    <div className="relative overflow-hidden">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <div className="flex items-center gap-3">
          <Link to="/auth" className="text-sm text-slate-300 transition hover:text-white">
            Sign in
          </Link>
          <Link to={cta}>
            <Button size="sm">Get Started</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 text-center sm:pt-24">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs text-slate-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            Live Indian market data · Grounded AI · Zero generic advice
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-6xl">
            Your personal <span className="text-gradient">AI investment advisor</span> for Indian markets
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">
            Seeker understands your income, goals, risk tolerance and tax situation — then combines it with live
            NSE prices, fundamentals and technicals to build strategies that fit <em className="text-slate-200">you</em>.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to={cta}>
              <Button size="lg">
                Get Started <ArrowRightIcon className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#features">
              <Button size="lg" variant="secondary">
                Explore features
              </Button>
            </a>
          </div>
        </motion.div>

        {/* Floating question chips */}
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.5 } } }}
          className="mx-auto mt-14 flex max-w-3xl flex-wrap items-center justify-center gap-2.5"
        >
          {QUESTIONS.map((q) => (
            <motion.span
              key={q}
              variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
              className="glass rounded-full px-4 py-2 text-xs text-slate-300"
            >
              “{q}”
            </motion.span>
          ))}
        </motion.div>

        {/* Mock advisory panel */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.7 }}
          className="glass mx-auto mt-14 max-w-3xl p-6 text-left"
        >
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Seeker Advisory</span>
            <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-medium text-accent-soft">
              Confidence 74/100
            </span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-slate-300">
            <span className="font-semibold text-white">Executive summary — </span>
            For your ₹5,00,000 with an aggressive risk band and 5–10 year horizon, deploy across 7 asset classes:
            48% direct equity (TCS, ICICI Bank, HAL…), 17% index ETFs, 10% debt, 7% gold. Expected CAGR ≈ 13.1%,
            volatility ≈ 15.8%. Your emergency fund covers 6 months — foundation is ready.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['Action', 'INVEST'],
              ['Risk', 'HIGH'],
              ['Horizon', '5–10 yrs'],
              ['P(loss)', '8.2%'],
            ].map(([k, v]) => (
              <div key={k} className="glass-inset px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">{k}</p>
                <p className="text-sm font-bold text-white">{v}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="text-center text-2xl font-bold text-white sm:text-3xl">
          A real advisor, not a chatbot
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm text-slate-400">
          Profile-aware. Data-grounded. Explainable. Every number traces to a source.
        </p>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: i * 0.06, duration: 0.5 }}
              className="glass glass-hover p-6"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-accent/25 to-series-1/25 text-accent">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-semibold text-white">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-6 pb-24 text-center">
        <div className="glass relative overflow-hidden p-10 sm:p-14">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full bg-accent/20 blur-3xl" />
          <h2 className="text-2xl font-bold text-white sm:text-3xl">Start with a 3-minute financial profile</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-slate-400">
            Nine quick steps. Then every answer Seeker gives is built for you — your goals, your risk, your taxes.
          </p>
          <Link to={cta} className="mt-7 inline-block">
            <Button size="lg">
              Create my profile <ArrowRightIcon className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/[0.06] py-8">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <p className="mx-auto max-w-2xl text-[11px] leading-relaxed text-slate-600">{SEBI_DISCLAIMER}</p>
          <p className="mt-3 text-xs text-slate-600">© {new Date().getFullYear()} Seeker AI</p>
        </div>
      </footer>
    </div>
  );
}

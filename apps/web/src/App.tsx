import { Suspense, lazy, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { AppShell } from '@/components/layout/AppShell';
import { Spinner } from '@/components/ui/spinner';

const LandingPage = lazy(() => import('@/features/landing/LandingPage'));
const AuthPage = lazy(() => import('@/features/auth/AuthPage'));
const OnboardingPage = lazy(() => import('@/features/onboarding/OnboardingPage'));
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const AdvisorPage = lazy(() => import('@/features/advisor/AdvisorPage'));
const ChatPage = lazy(() => import('@/features/chat/ChatPage'));
const StocksPage = lazy(() => import('@/features/stocks/StocksPage'));
const StockDetailPage = lazy(() => import('@/features/stocks/StockDetailPage'));
const PortfolioPage = lazy(() => import('@/features/portfolio/PortfolioPage'));
const StrategiesPage = lazy(() => import('@/features/strategies/StrategiesPage'));
const WatchlistPage = lazy(() => import('@/features/watchlist/WatchlistPage'));
const InsightsPage = lazy(() => import('@/features/insights/InsightsPage'));
const CalculatorsPage = lazy(() => import('@/features/calculators/CalculatorsPage'));
const RiskLabPage = lazy(() => import('@/features/calculators/RiskLabPage'));

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner className="h-8 w-8 text-accent" />
    </div>
  );
}

/** Requires a session; pushes un-onboarded users into the wizard. */
function Protected({ children, allowUnonboarded = false }: { children: ReactNode; allowUnonboarded?: boolean }) {
  const { user, accessToken } = useAuthStore();
  const location = useLocation();
  if (!user || !accessToken) return <Navigate to="/auth" state={{ from: location }} replace />;
  if (!user.onboarded && !allowUnonboarded) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/onboarding"
          element={
            <Protected allowUnonboarded>
              <OnboardingPage />
            </Protected>
          }
        />
        <Route
          path="/app"
          element={
            <Protected>
              <AppShell />
            </Protected>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="advisor" element={<AdvisorPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="stocks" element={<StocksPage />} />
          <Route path="stocks/:symbol" element={<StockDetailPage />} />
          <Route path="portfolio" element={<PortfolioPage />} />
          <Route path="strategies" element={<StrategiesPage />} />
          <Route path="watchlist" element={<WatchlistPage />} />
          <Route path="insights" element={<InsightsPage />} />
          <Route path="tools" element={<CalculatorsPage />} />
          <Route path="simulator" element={<RiskLabPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

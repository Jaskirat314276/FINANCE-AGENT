import { useQuery } from '@tanstack/react-query';
import type { HealthScoreReport, MarketSnapshot, MoverEntry, RiskBand } from '@seeker/shared';
import { api } from '@/lib/api';

export interface DashboardSummary {
  user: { name: string };
  netWorth: number;
  investedTotal: number;
  monthlyInvestment: number;
  monthlySurplus: number;
  riskScore: number;
  riskBand: RiskBand;
  financialHealth: HealthScoreReport;
  investmentReadiness: { score: number; notes: string[] };
  assetAllocation: Array<{ label: string; value: number }>;
  goalProgress: Array<{
    type: string;
    label: string;
    targetAmount: number;
    inflatedTarget: number;
    targetYears: number;
    allocatedSip: number;
    requiredSip: number;
    fundedPct: number;
    onTrack: boolean;
  }>;
  suggestions: Array<{ icon: 'shield' | 'trend' | 'tax' | 'warning' | 'spark'; title: string; detail: string }>;
}

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardSummary>('/profile/dashboard'),
  });
}

export function useMarketSnapshot() {
  return useQuery({
    queryKey: ['market-snapshot'],
    queryFn: () => api.get<MarketSnapshot>('/market/snapshot'),
    refetchInterval: 5 * 60_000,
  });
}

export function useTrending() {
  return useQuery({
    queryKey: ['trending'],
    queryFn: () => api.get<{ stocks: MoverEntry[] }>('/stocks/trending'),
    refetchInterval: 5 * 60_000,
  });
}

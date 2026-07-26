import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AiStockSummary, Candle, CandleRange, StockOverview } from '@seeker/shared';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/toast';

export interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  inUniverse?: boolean;
}

export function useStockSearch(query: string) {
  return useQuery({
    queryKey: ['stock-search', query],
    queryFn: () => api.get<{ results: SearchResult[] }>(`/stocks/search?q=${encodeURIComponent(query)}`),
    enabled: query.trim().length >= 2,
    staleTime: 60_000,
  });
}

export function useStockOverview(symbol: string | undefined) {
  return useQuery({
    queryKey: ['stock', symbol],
    queryFn: () => api.get<StockOverview>(`/stocks/${symbol}`),
    enabled: !!symbol,
    refetchInterval: 60_000,
  });
}

export function useCandles(symbol: string | undefined, range: CandleRange) {
  return useQuery({
    queryKey: ['candles', symbol, range],
    queryFn: () => api.get<{ candles: Candle[] }>(`/stocks/${symbol}/candles?range=${range}`),
    enabled: !!symbol,
    staleTime: 5 * 60_000,
  });
}

export function useAiSummary(symbol: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['ai-summary', symbol],
    queryFn: () => api.get<AiStockSummary>(`/advisor/stock/${symbol}/summary`),
    enabled: !!symbol && enabled,
    staleTime: 10 * 60_000,
    retry: false,
  });
}

export interface ScreenerRow {
  symbol: string;
  name: string;
  sector: string;
  mcap: string;
  price: number;
  changePct: number;
  pe: number | null;
  roe: number | null;
  divYieldPct: number | null;
  debtToEquity: number | null;
  profitGrowthPct: number | null;
  marketCap: number | null;
}

export function useScreener(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return useQuery({
    queryKey: ['screener', qs],
    queryFn: () => api.get<{ results: ScreenerRow[]; matched: number; universeSize: number }>(`/screener?${qs}`),
    staleTime: 5 * 60_000,
  });
}

export function useAddToWatchlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (symbol: string) => api.post('/watchlist', { symbol }),
    onSuccess: (_d, symbol) => {
      toast.success(`${symbol} added to watchlist`);
      void qc.invalidateQueries({ queryKey: ['watchlist'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not add'),
  });
}

"use client";

import useSWR from "swr";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

// --- Performance types ---

interface DailyPnL {
  timestamp: string;
  daily_pnl: number;
  trade_count: number;
}

interface PerformanceSummary {
  total_pnl: number;
  total_trades: number;
  avg_trade_value: number;
  max_trade_value: number;
  min_trade_value: number;
}

interface SideBreakdown {
  side: number;
  count: number;
  total_value: number;
  avg_value: number;
}

interface PerformanceData {
  dailyPnl: DailyPnL[];
  summary: PerformanceSummary | null;
  sideBreakdown: SideBreakdown[];
  // True when the period had more fills than the realized-P&L fold cap, so the
  // P&L reflects only the earliest fills in the window.
  capped?: boolean;
}

// --- Execution types ---

interface StatusBreakdown {
  status: string;
  count: number;
}

interface RejectReason {
  reason: string;
  count: number;
}

interface OrderStats {
  totalOrders: number;
  filledOrders: number;
  fillRate: number;
}

interface ExecutionData {
  statusBreakdown: StatusBreakdown[];
  rejectReasons: RejectReason[];
  orderStats: OrderStats | null;
}

// --- Volume types ---

interface SymbolVolume {
  symbol_id: number;
  trade_count: number;
  total_volume: number;
}

interface HourlyVolume {
  timestamp: string;
  trade_count: number;
  volume: number;
}

interface BuySellEntry {
  side: number;
  count: number;
  total_qty: number;
  total_volume: number;
}

interface VolumeData {
  bySymbol: SymbolVolume[];
  hourly: HourlyVolume[];
  buySellRatio: BuySellEntry[];
}

// --- Hooks ---

export function usePerformance(period = "7d") {
  const { data, error, isLoading } = useSWR<PerformanceData>(
    `/api/reports/performance?period=${period}`,
    fetcher,
    { refreshInterval: 30000 }
  );
  return { data: data ?? null, error, isLoading };
}

export function useExecution(days = 7) {
  const { data, error, isLoading } = useSWR<ExecutionData>(
    `/api/reports/execution?days=${days}`,
    fetcher,
    { refreshInterval: 30000 }
  );
  return { data: data ?? null, error, isLoading };
}

export function useVolume(days = 7) {
  const { data, error, isLoading } = useSWR<VolumeData>(
    `/api/reports/volume?days=${days}`,
    fetcher,
    { refreshInterval: 30000 }
  );
  return { data: data ?? null, error, isLoading };
}

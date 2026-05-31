"use client";

import { useState, useCallback, useSyncExternalStore } from "react";
import { usePerformance, useExecution, useVolume } from "@/hooks/useReports";
import { PageHeader } from "@/components/ui/page-header";
import { MetricStrip } from "@/components/ui/metric-strip";
import { cn, formatPrice, formatPnl, pnlColor, getSymbolName } from "@/lib/utils";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
} from "recharts";

const PERIODS = [
  { label: "1D", value: "1d" },
  { label: "7D", value: "7d" },
  { label: "30D", value: "30d" },
];

const PIE_COLORS = [
  "oklch(0.623 0.214 259)", // blue
  "oklch(0.7 0.2 150)", // green
  "oklch(0.65 0.2 30)", // orange
  "oklch(0.6 0.2 330)", // pink
  "oklch(0.7 0.15 200)", // teal
  "oklch(0.65 0.18 90)", // yellow
];

const TOOLTIP_STYLE = {
  backgroundColor: "oklch(0.19 0.005 285)",
  border: "1px solid oklch(0.3 0 0)",
  borderRadius: "4px",
  fontSize: "12px",
  color: "oklch(0.9 0 0)",
};

const AXIS_TICK = { fill: "oklch(0.55 0 0)", fontSize: 10 };
const AXIS_TICK_MOBILE = { fill: "oklch(0.55 0 0)", fontSize: 8 };

function formatCompactDate(ts: string): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatHour(ts: string): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:00`;
}

function formatHourShort(ts: string): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:00`;
}

/** Custom hook to detect mobile viewport using useSyncExternalStore */
function useIsMobile() {
  const subscribe = useCallback((callback: () => void) => {
    const mq = window.matchMedia("(max-width: 639px)");
    mq.addEventListener("change", callback);
    return () => mq.removeEventListener("change", callback);
  }, []);

  const getSnapshot = useCallback(
    () => window.matchMedia("(max-width: 639px)").matches,
    [],
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

export default function ReportsPage() {
  const [period, setPeriod] = useState("7d");
  const days = period === "1d" ? 1 : period === "7d" ? 7 : 30;
  const isMobile = useIsMobile();

  const { data: perfData, isLoading: perfLoading, error: perfError } = usePerformance(period);
  const { data: execData, isLoading: execLoading, error: execError } = useExecution(days);
  const { data: volData, isLoading: volLoading, error: volError } = useVolume(days);

  const totalPnl = perfData?.summary?.total_pnl ?? 0;
  const totalTrades = perfData?.summary?.total_trades ?? 0;
  const avgTradeValue = perfData?.summary?.avg_trade_value ?? 0;
  const pnlCapped = perfData?.capped ?? false;

  const buyCount =
    perfData?.sideBreakdown?.find((s) => s.side === 1)?.count ?? 0;
  const sellCount =
    perfData?.sideBreakdown?.find((s) => s.side === 2)?.count ?? 0;
  const buySellRatioStr =
    buyCount + sellCount > 0
      ? `${((buyCount / (buyCount + sellCount)) * 100).toFixed(0)}% / ${((sellCount / (buyCount + sellCount)) * 100).toFixed(0)}%`
      : "N/A";

  // Prepare daily P&L chart data
  const dailyPnlData = (perfData?.dailyPnl ?? []).map((d) => ({
    date: formatCompactDate(d.timestamp),
    pnl: Math.round(d.daily_pnl * 100) / 100,
    trades: d.trade_count,
  }));

  // Execution data
  const fillRate = execData?.orderStats?.fillRate ?? 0;
  const totalOrders = execData?.orderStats?.totalOrders ?? 0;

  const rejectData = (execData?.rejectReasons ?? []).map((r) => ({
    name: r.reason,
    value: r.count,
  }));

  const statusData = (execData?.statusBreakdown ?? []).map((s) => ({
    name: s.status,
    count: s.count,
  }));

  // Volume data
  const symbolData = (volData?.bySymbol ?? []).map((s) => ({
    symbol: getSymbolName(s.symbol_id),
    trades: s.trade_count,
    volume: Math.round(s.total_volume * 100) / 100,
  }));

  const hourlyData = (volData?.hourly ?? []).map((h) => ({
    time: isMobile ? formatHourShort(h.timestamp) : formatHour(h.timestamp),
    trades: h.trade_count,
    volume: Math.round(h.volume * 100) / 100,
  }));

  const buyVolume =
    volData?.buySellRatio?.find((s) => s.side === 1)?.total_volume ?? 0;
  const sellVolume =
    volData?.buySellRatio?.find((s) => s.side === 2)?.total_volume ?? 0;

  const isLoading = perfLoading || execLoading || volLoading;
  const hasError = !!(perfError || execError || volError);

  // Responsive chart height
  const chartHeightLg = 280;
  const chartHeightSm = 220;
  const chartHeight = isMobile ? chartHeightSm : chartHeightLg;
  const smallChartHeight = isMobile ? 200 : 240;

  const periodSelector = (
    <div className="flex gap-1 rounded-lg border bg-muted p-0.5">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => setPeriod(p.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            period === p.value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );

  // Failed to load — distinct from "no data". Reports can fail if the trading
  // data service is unavailable or a query times out; don't masquerade it as
  // an empty state.
  if (!isLoading && hasError) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <PageHeader title="Reports" actions={periodSelector} />
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 text-red-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
          </div>
          <h3 className="text-sm font-medium text-foreground">Couldn&apos;t load reports</h3>
          <p className="mt-1 text-[11px] text-muted-foreground max-w-sm">
            The trading data service didn&apos;t respond in time. This can happen under heavy load — try again.
          </p>
          <div className="mt-4">
            <button onClick={() => window.location.reload()} className="rounded-md border border-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors">
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show empty state when no data exists
  if (!isLoading && totalTrades === 0 && totalOrders === 0) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <PageHeader title="Reports" actions={periodSelector} />
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>
          </div>
          <h3 className="text-sm font-medium text-foreground">No trading data yet</h3>
          <p className="mt-1 text-[11px] text-muted-foreground max-w-sm">
            Your performance reports, execution analytics, and volume breakdowns will appear here once you start trading.
          </p>
          <div className="mt-4">
            <a href="/backtest" className="rounded-md border border-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors">
              Run a Backtest
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <PageHeader title="Reports" actions={periodSelector} />

      {/* Section 1: Performance Overview */}
      <section className="space-y-3 sm:space-y-4">
        <h2 className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Performance Overview
        </h2>

        {/* Summary metrics */}
        <MetricStrip
          metrics={[
            {
              label: "Realized P&L",
              value: formatPnl(totalPnl),
              changeColor: pnlColor(totalPnl),
            },
            {
              label: "Total Trades",
              value: totalTrades.toLocaleString(),
            },
            {
              label: "Avg Trade Value",
              value: formatPrice(avgTradeValue),
            },
            {
              label: "Buy / Sell",
              value: buySellRatioStr,
            },
          ]}
        />

        {pnlCapped && (
          <p className="text-[11px] text-orange-400">
            High trade volume — realized P&amp;L reflects the earliest fills in this period.
          </p>
        )}

        {/* Daily P&L bar chart */}
        <div className="border-t border-border/50 pt-4 mt-4">
          <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Daily Realized P&L</h3>
          <div className="px-2 sm:px-0">
            {dailyPnlData.length > 0 ? (
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart data={dailyPnlData} margin={isMobile ? { left: -15, right: 5 } : undefined}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="oklch(0.3 0 0)"
                    opacity={0.3}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={isMobile ? AXIS_TICK_MOBILE : AXIS_TICK}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={isMobile ? AXIS_TICK_MOBILE : AXIS_TICK}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => formatPrice(v, 0)}
                    width={isMobile ? 45 : 60}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value) => [formatPrice(Number(value)), "P&L"]}
                  />
                  <Bar
                    dataKey="pnl"
                    radius={[3, 3, 0, 0]}
                    fill="oklch(0.623 0.214 259)"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className={cn("flex items-center justify-center text-sm text-muted-foreground", isMobile ? "h-[220px]" : "h-[280px]")}>
                {isLoading ? "Loading..." : "No trade data available"}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Section 2: Execution Quality */}
      <section className="space-y-3 sm:space-y-4">
        <h2 className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Execution Quality
        </h2>

        {/* Summary metrics */}
        <MetricStrip
          metrics={[
            {
              label: "Fill Rate",
              value: `${fillRate}%`,
            },
            {
              label: "Total Orders",
              value: totalOrders.toLocaleString(),
            },
            {
              label: "Risk Rejections",
              value: rejectData.reduce((sum, r) => sum + r.value, 0).toLocaleString(),
            },
          ]}
        />

        {/* Charts row */}
        <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
          {/* Order status breakdown */}
          <div className="border-t border-border/50 pt-4 mt-4">
            <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Order Status Breakdown</h3>
            <div className="px-2 sm:px-0">
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={smallChartHeight}>
                  <BarChart data={statusData} layout="vertical" margin={isMobile ? { left: -5, right: 5 } : undefined}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="oklch(0.3 0 0)"
                      opacity={0.3}
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={isMobile ? AXIS_TICK_MOBILE : AXIS_TICK}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={isMobile ? AXIS_TICK_MOBILE : AXIS_TICK}
                      tickLine={false}
                      axisLine={false}
                      width={isMobile ? 60 : 80}
                    />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar
                      dataKey="count"
                      fill="oklch(0.623 0.214 259)"
                      radius={[0, 3, 3, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className={cn("flex items-center justify-center text-sm text-muted-foreground", isMobile ? "h-[200px]" : "h-[240px]")}>
                  {isLoading ? "Loading..." : "No order data available"}
                </div>
              )}
            </div>
          </div>

          {/* Rejection reasons pie chart */}
          <div className="border-t border-border/50 pt-4 mt-4">
            <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Rejection Reasons</h3>
            <div className="px-2 sm:px-0">
              {rejectData.length > 0 ? (
                <ResponsiveContainer width="100%" height={smallChartHeight}>
                  <PieChart>
                    <Pie
                      data={rejectData}
                      cx="50%"
                      cy="50%"
                      innerRadius={isMobile ? 35 : 50}
                      outerRadius={isMobile ? 65 : 90}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                      label={isMobile ? false : ({ name, percent }) =>
                        `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
                      }
                      labelLine={!isMobile}
                    >
                      {rejectData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    {isMobile && (
                      <Legend
                        wrapperStyle={{ fontSize: "10px" }}
                        iconSize={8}
                      />
                    )}
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className={cn("flex items-center justify-center text-sm text-muted-foreground", isMobile ? "h-[200px]" : "h-[240px]")}>
                  {isLoading ? "Loading..." : "No rejection data available"}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Volume Analytics */}
      <section className="space-y-3 sm:space-y-4">
        <h2 className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Volume Analytics
        </h2>

        {/* Volume summary metrics */}
        <MetricStrip
          metrics={[
            {
              label: "Buy Volume",
              value: formatPrice(buyVolume, 0),
              changeColor: "text-positive",
            },
            {
              label: "Sell Volume",
              value: formatPrice(sellVolume, 0),
              changeColor: "text-negative",
            },
            {
              label: "Symbols Traded",
              value: symbolData.length,
            },
          ]}
        />

        <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
          {/* Volume by symbol */}
          <div className="border-t border-border/50 pt-4 mt-4">
            <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Trades by Symbol</h3>
            <div className="px-2 sm:px-0">
              {symbolData.length > 0 ? (
                <ResponsiveContainer width="100%" height={smallChartHeight}>
                  <BarChart data={symbolData} margin={isMobile ? { left: -15, right: 5 } : undefined}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="oklch(0.3 0 0)"
                      opacity={0.3}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="symbol"
                      tick={isMobile ? AXIS_TICK_MOBILE : AXIS_TICK}
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                      angle={isMobile ? -45 : 0}
                      textAnchor={isMobile ? "end" : "middle"}
                      height={isMobile ? 50 : 30}
                    />
                    <YAxis
                      tick={isMobile ? AXIS_TICK_MOBILE : AXIS_TICK}
                      tickLine={false}
                      axisLine={false}
                      width={isMobile ? 35 : 50}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value, name) => [
                        name === "trades"
                          ? Number(value).toLocaleString()
                          : formatPrice(Number(value)),
                        name === "trades" ? "Trade Count" : "Volume",
                      ]}
                    />
                    <Bar
                      dataKey="trades"
                      fill="oklch(0.623 0.214 259)"
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className={cn("flex items-center justify-center text-sm text-muted-foreground", isMobile ? "h-[200px]" : "h-[240px]")}>
                  {isLoading ? "Loading..." : "No volume data available"}
                </div>
              )}
            </div>
          </div>

          {/* Hourly volume */}
          <div className="border-t border-border/50 pt-4 mt-4">
            <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Hourly Trade Activity</h3>
            <div className="px-2 sm:px-0">
              {hourlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={smallChartHeight}>
                  <AreaChart data={hourlyData} margin={isMobile ? { left: -15, right: 5 } : undefined}>
                    <defs>
                      <linearGradient
                        id="volumeGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="oklch(0.623 0.214 259)"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="oklch(0.623 0.214 259)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="oklch(0.3 0 0)"
                      opacity={0.3}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="time"
                      tick={isMobile ? AXIS_TICK_MOBILE : AXIS_TICK}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={isMobile ? AXIS_TICK_MOBILE : AXIS_TICK}
                      tickLine={false}
                      axisLine={false}
                      width={isMobile ? 35 : 50}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value) => [
                        Number(value).toLocaleString(),
                        "Trades",
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="trades"
                      stroke="oklch(0.623 0.214 259)"
                      strokeWidth={2}
                      fill="url(#volumeGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className={cn("flex items-center justify-center text-sm text-muted-foreground", isMobile ? "h-[200px]" : "h-[240px]")}>
                  {isLoading ? "Loading..." : "No hourly data available"}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

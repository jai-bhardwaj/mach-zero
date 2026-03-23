"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface BacktestResults {
  strategy: string;
  symbol: string;
  simulated?: boolean;
  totalPnl: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  profitFactor: number;
  totalTrades: number;
  wins: number;
  losses: number;
  equityCurve: Array<{ timestamp: number; equity: number }>;
  trades: Array<{
    timestamp: number;
    side: string;
    price: number;
    quantity: number;
    pnl: number;
  }>;
  error?: string;
}

const STRATEGIES = [
  { value: "SimpleSpread", label: "Simple Spread" },
  { value: "MomentumBreakout", label: "Momentum Breakout" },
  { value: "MeanReversion", label: "Mean Reversion" },
  { value: "MarketMaker", label: "Market Maker" },
];

const SYMBOLS = [
  { id: 1, name: "BTCUSDT" },
  { id: 2, name: "ETHUSDT" },
  { id: 3, name: "BNBUSDT" },
];

export function BacktestClient() {
  const [strategy, setStrategy] = useState("SimpleSpread");
  const [symbolId, setSymbolId] = useState(1);
  const [numTrades, setNumTrades] = useState(500);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BacktestResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedSymbol = SYMBOLS.find((s) => s.id === symbolId)?.name ?? "BTCUSDT";

  const runBacktest = async () => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategy,
          symbolId,
          symbolName: selectedSymbol,
          numTrades,
          params: {},
        }),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setResults(data);
      }
    } catch {
      setError("Failed to run backtest");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-semibold text-zinc-100">Backtesting</h1>

      {/* Config Form */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Strategy</label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              className="w-full rounded-md border border-border bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            >
              {STRATEGIES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Symbol</label>
            <select
              value={symbolId}
              onChange={(e) => setSymbolId(Number(e.target.value))}
              className="w-full rounded-md border border-border bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            >
              {SYMBOLS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">
              Trades to Simulate
            </label>
            <input
              type="number"
              value={numTrades}
              onChange={(e) => setNumTrades(Number(e.target.value))}
              min={100}
              max={10000}
              className="w-full rounded-md border border-border bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={runBacktest}
              disabled={loading}
              className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/80 disabled:opacity-50"
            >
              {loading ? "Running..." : "Run Backtest"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-900/10 p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {results && <BacktestResultsPanel results={results} />}
    </div>
  );
}

function BacktestResultsPanel({ results }: { results: BacktestResults }) {
  return (
    <div className="space-y-6">
      {results.simulated && (
        <div className="rounded-md bg-blue-900/20 px-3 py-2 text-xs text-blue-400">
          Simulated results — C++ backtest engine not connected
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard
          label="Total P&L"
          value={`$${results.totalPnl.toLocaleString()}`}
          color={results.totalPnl >= 0 ? "text-green-400" : "text-red-400"}
        />
        <MetricCard
          label="Win Rate"
          value={`${results.winRate}%`}
          color={results.winRate >= 50 ? "text-green-400" : "text-red-400"}
        />
        <MetricCard
          label="Sharpe Ratio"
          value={results.sharpeRatio.toFixed(2)}
          color={results.sharpeRatio >= 1 ? "text-green-400" : "text-yellow-400"}
        />
        <MetricCard
          label="Max Drawdown"
          value={`${results.maxDrawdown}%`}
          color="text-red-400"
        />
        <MetricCard
          label="Profit Factor"
          value={results.profitFactor.toFixed(2)}
          color={results.profitFactor >= 1 ? "text-green-400" : "text-red-400"}
        />
      </div>

      {/* Equity Curve */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-medium text-zinc-400">Equity Curve</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={results.equityCurve}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(ts) =>
                  new Date(ts).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })
                }
                stroke="#52525b"
                tick={{ fontSize: 10 }}
              />
              <YAxis
                stroke="#52525b"
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "1px solid #3f3f46",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
                labelFormatter={(ts) => new Date(ts as number).toLocaleString()}
                formatter={(v) => [`$${Number(v).toLocaleString()}`, "Equity"]}
              />
              <Line
                type="monotone"
                dataKey="equity"
                stroke="#22c55e"
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Trade List */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-medium text-zinc-400">
          Recent Trades ({results.totalTrades} total: {results.wins}W / {results.losses}L)
        </h3>
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-zinc-500">
                <th className="pb-1.5 text-left font-medium">Time</th>
                <th className="pb-1.5 text-left font-medium">Side</th>
                <th className="pb-1.5 text-right font-medium">Price</th>
                <th className="pb-1.5 text-right font-medium">Qty</th>
                <th className="pb-1.5 text-right font-medium">P&L</th>
              </tr>
            </thead>
            <tbody>
              {results.trades.map((t, i) => (
                <tr
                  key={i}
                  className="border-b border-border/50 last:border-0"
                >
                  <td className="py-1.5 text-zinc-400">
                    {new Date(t.timestamp).toLocaleTimeString()}
                  </td>
                  <td
                    className={cn(
                      "py-1.5 font-medium",
                      t.side === "BUY" ? "text-green-400" : "text-red-400"
                    )}
                  >
                    {t.side}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-zinc-300">
                    {t.price.toLocaleString()}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-zinc-400">
                    {t.quantity}
                  </td>
                  <td
                    className={cn(
                      "py-1.5 text-right tabular-nums font-medium",
                      t.pnl >= 0 ? "text-green-400" : "text-red-400"
                    )}
                  >
                    {t.pnl >= 0 ? "+" : ""}
                    {t.pnl.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={cn("mt-1 text-lg font-semibold tabular-nums", color)}>
        {value}
      </p>
    </div>
  );
}

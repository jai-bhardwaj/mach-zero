"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { realizedPnlSeries } from "@/lib/pnl";

interface PnLPoint {
  timestamp: string;
  pnl: number;
}

export function PnLChart() {
  const [data, setData] = useState<PnLPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchPnL = async () => {
      try {
        const res = await fetch("/api/trades?limit=500");
        if (!res.ok) {
          setError(true);
          setLoading(false);
          return;
        }
        const result = await res.json();
        const trades = (result.data ?? result) as Array<{
          symbol_id: number; side: number; price: number; quantity: number; timestamp: string;
        }>;

        // Chronological order, then realized P&L (average-cost) per fill — not a
        // raw cashflow sum, which would mislabel an open one-sided position.
        const chronological = [...trades].reverse();
        const realized = realizedPnlSeries(chronological);
        const points: PnLPoint[] = chronological.map((trade, i) => ({
          timestamp: new Date(trade.timestamp).toLocaleTimeString(),
          pnl: realized[i],
        }));

        setData(points);
        setError(false);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchPnL();
    const interval = setInterval(fetchPnL, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="border-t border-border/50 pt-4">
        <p className="py-8 text-center text-xs text-muted-foreground">
          Loading P&L chart...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-t border-border/50 pt-4">
        <p className="py-8 text-center text-xs text-muted-foreground">
          Failed to load P&L data.
        </p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="border-t border-border/50 pt-4">
        <p className="py-8 text-center text-xs text-muted-foreground">
          No trade data for P&L chart.
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-border/50 pt-4">
      <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-3">
        Realized P&L
      </h3>
      <div className="px-0 sm:px-2">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="oklch(0.25 0 0)"
              opacity={0.3}
              vertical={false}
            />
            <XAxis
              dataKey="timestamp"
              tick={{ fill: "oklch(0.55 0 0)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fill: "oklch(0.55 0 0)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "oklch(0.185 0.005 285)",
                border: "1px solid oklch(0.3 0 0)",
                borderRadius: "4px",
                fontSize: "12px",
              }}
            />
            <Line
              type="monotone"
              dataKey="pnl"
              stroke="oklch(0.623 0.214 259)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

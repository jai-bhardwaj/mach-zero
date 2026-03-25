"use client";

import type { SymbolState } from "@/types";
import { formatPnl, pnlColor, cn } from "@/lib/utils";
import { MetricStrip } from "@/components/ui/metric-strip";

interface Props {
  symbols: SymbolState[];
  connected: boolean;
}

export function SummaryCards({ symbols, connected }: Props) {
  const hasData = symbols.length > 0;

  const totalPnl = symbols.reduce(
    (sum, s) => sum + s.realizedPnl + s.unrealizedPnl,
    0
  );
  const totalRealizedPnl = symbols.reduce((sum, s) => sum + s.realizedPnl, 0);
  const totalTrades = symbols.reduce((sum, s) => sum + s.fillCount, 0);
  const totalOrders = symbols.reduce((sum, s) => sum + s.orderCount, 0);
  const activePositions = symbols.filter((s) => s.position !== 0).length;

  const metrics = [
    {
      label: "Total P&L",
      value: hasData ? formatPnl(totalPnl) : "---",
      changeColor: hasData ? pnlColor(totalPnl) : undefined,
    },
    {
      label: "Realized P&L",
      value: hasData ? formatPnl(totalRealizedPnl) : "---",
      changeColor: hasData ? pnlColor(totalRealizedPnl) : undefined,
    },
    {
      label: "Active Positions",
      value: hasData ? String(activePositions) : "---",
    },
    {
      label: "Fills / Orders",
      value: hasData ? `${totalTrades} / ${totalOrders}` : "--- / ---",
    },
  ];

  return (
    <div>
      <MetricStrip metrics={metrics} />
      <div className="flex items-center gap-1.5 mt-3 text-[11px] text-muted-foreground">
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            connected
              ? "bg-green-500"
              : hasData
                ? "bg-red-500"
                : "bg-amber-500"
          )}
        />
        {connected
          ? "Connected"
          : hasData
            ? "Disconnected"
            : "Waiting for connection"}
        {" · "}
        {hasData ? `${symbols.length} symbols` : "No data yet"}
      </div>
    </div>
  );
}

"use client";

import type { SymbolState } from "@/types";
import { formatPnl, pnlColor, cn } from "@/lib/utils";
import { MetricStrip } from "@/components/ui/metric-strip";

interface Props {
  symbols: SymbolState[];
  connected: boolean;
}

export function SummaryCards({ symbols, connected }: Props) {
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
      value: formatPnl(totalPnl),
      changeColor: pnlColor(totalPnl),
    },
    {
      label: "Realized P&L",
      value: formatPnl(totalRealizedPnl),
      changeColor: pnlColor(totalRealizedPnl),
    },
    {
      label: "Active Positions",
      value: String(activePositions),
    },
    {
      label: "Fills / Orders",
      value: `${totalTrades} / ${totalOrders}`,
    },
  ];

  return (
    <div>
      <MetricStrip metrics={metrics} />
      <div className="flex items-center gap-1.5 mt-3 text-[11px] text-muted-foreground">
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            connected ? "bg-green-500" : "bg-red-500"
          )}
        />
        {connected ? "Connected" : "Disconnected"}
        {" · "}
        {symbols.length} symbols
      </div>
    </div>
  );
}

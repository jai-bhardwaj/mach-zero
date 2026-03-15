"use client";

import { useRiskEvents } from "@/hooks/useTrades";

export function RiskMetrics() {
  const { events, isLoading } = useRiskEvents({ limit: 200 });

  if (isLoading) {
    return (
      <div>
        <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-3">Risk Rejections</h2>
        <p className="text-xs text-muted-foreground">Loading risk metrics...</p>
      </div>
    );
  }

  // Aggregate rejection reasons
  const reasonCounts: Record<string, number> = {};
  for (const evt of events) {
    reasonCounts[evt.reason] = (reasonCounts[evt.reason] || 0) + 1;
  }

  const sorted = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-3">Risk Rejections</h2>
      {sorted.length === 0 ? (
        <p className="text-xs text-muted-foreground">No rejections recorded.</p>
      ) : (
        <div>
          {sorted.map(([reason, count]) => (
            <div
              key={reason}
              className="flex justify-between py-1.5 border-b border-border/50"
            >
              <span className="text-xs text-red-600 dark:text-red-400">{reason}</span>
              <span className="text-xs font-mono tabular-nums text-muted-foreground">{count}</span>
            </div>
          ))}
          <div className="mt-2 text-[11px] text-muted-foreground">
            Total: {events.length} rejection(s)
          </div>
        </div>
      )}
    </div>
  );
}

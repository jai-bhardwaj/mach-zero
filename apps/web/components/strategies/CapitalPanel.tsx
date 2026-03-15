"use client";

import type { CapitalPool } from "@/types";
import { formatPrice, cn } from "@/lib/utils";

interface Props {
  pools: CapitalPool[];
}

export function CapitalPanel({ pools }: Props) {
  if (pools.length === 0) {
    return (
      <div className="py-6 text-center text-muted-foreground">
        No capital pools configured. Create a pool for a trading account to start
        allocating capital.
      </div>
    );
  }

  return (
    <div>
      {pools.map((pool, index) => {
        const available = pool.totalCapital - pool.allocatedTotal;
        const utilizationPct =
          pool.totalCapital > 0
            ? (pool.allocatedTotal / pool.totalCapital) * 100
            : 0;
        const marginPct =
          pool.totalCapital > 0
            ? (pool.reservedMargin / pool.totalCapital) * 100
            : 0;

        return (
          <div
            key={pool.id}
            className={cn(
              "space-y-3 py-3",
              index < pools.length - 1 && "border-b border-border/50"
            )}
          >
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold">
                  {pool.account?.name ?? "Account"}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {pool.account?.venue} &middot; {pool.currency}
                </span>
              </div>
              <div className="sm:text-right">
                <div className="text-base font-semibold tabular-nums sm:text-lg">
                  {formatPrice(pool.totalCapital)}
                </div>
                <div className="text-xs text-muted-foreground">Total Capital</div>
              </div>
            </div>

            {/* Utilization bar */}
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-muted-foreground">
                  Allocated: <span className="tabular-nums">{formatPrice(pool.allocatedTotal)}</span>
                </span>
                <span className="text-muted-foreground">
                  Available: <span className="tabular-nums">{formatPrice(available)}</span>
                </span>
              </div>
              <div className="h-1 w-full rounded-full bg-muted">
                <div
                  className={cn(
                    "h-1 rounded-full transition-all",
                    utilizationPct > 90
                      ? "bg-red-500"
                      : utilizationPct > 70
                      ? "bg-yellow-500"
                      : "bg-primary"
                  )}
                  style={{ width: `${Math.min(utilizationPct, 100)}%` }}
                />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {utilizationPct.toFixed(1)}% allocated &middot;{" "}
                {marginPct.toFixed(1)}% margin used
              </div>
            </div>

            {/* Per-strategy allocations */}
            {pool.allocations && pool.allocations.length > 0 && (
              <div className="space-y-1">
                {pool.allocations.map((alloc) => {
                  const stratPct =
                    pool.totalCapital > 0
                      ? (alloc.allocatedAmt / pool.totalCapital) * 100
                      : 0;
                  return (
                    <div
                      key={alloc.id}
                      className="flex flex-col gap-0.5 px-3 py-1.5 text-xs sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span>
                        {alloc.strategy?.name ?? alloc.strategyId}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono tabular-nums text-muted-foreground">
                          {formatPrice(alloc.allocatedAmt)} ({stratPct.toFixed(1)}%)
                        </span>
                        <span className="text-muted-foreground">
                          margin: {formatPrice(alloc.usedMargin)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

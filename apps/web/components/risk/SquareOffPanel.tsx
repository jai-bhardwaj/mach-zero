"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { SquareOffResult } from "@/types";
import { useSquareOff } from "@/hooks/useSquareOff";
import { usePositions } from "@/hooks/usePositions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SquareOffPanel() {
  const { squareOff, loading } = useSquareOff();
  const { symbols } = usePositions();
  const [confirmText, setConfirmText] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [result, setResult] = useState<SquareOffResult | null>(null);

  const openPositions = symbols.filter((s) => s.position !== 0);
  const totalPositionCount = openPositions.length;

  const handleSquareOffAll = async () => {
    const data = await squareOff({
      scope: "tenant",
      activateKillSwitch: true,
    });
    setResult(data);
    setShowConfirm(false);
    setConfirmText("");
    if (data.success) {
      toast.success(
        `Square-off complete — ${data.symbolsSquaredOff} symbols, ${data.strategiesPaused} strategies paused`
      );
    } else {
      toast.error("Square-off failed");
    }
  };

  const handleCancel = () => {
    setShowConfirm(false);
    setConfirmText("");
    setResult(null);
  };

  const canConfirm = confirmText === "SQUARE OFF";

  return (
    <div className="rounded-lg border border-amber-500/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Square Off All Positions</h2>
        {totalPositionCount > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            {totalPositionCount} open position{totalPositionCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
          Closes all open positions across all strategies by sending market
          orders. All strategies will be paused and the kill switch will be
          activated.
        </p>

        {/* Open positions summary */}
        {openPositions.length > 0 && (
          <div className="mb-4 space-y-1">
            {openPositions.map((sym) => (
              <div
                key={sym.symbolId}
                className="flex items-center justify-between border-b border-border/50 px-3 py-1.5 text-xs"
              >
                <span className="font-medium">{sym.name}</span>
                <span
                  className={cn(
                    "font-mono tabular-nums font-semibold",
                    sym.position > 0
                      ? "text-positive"
                      : "text-negative"
                  )}
                >
                  {sym.position > 0 ? "+" : ""}
                  {sym.position}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Result display */}
        {result && (
          <div
            className={cn(
              "mb-4 rounded-lg border p-4 text-sm",
              result.success
                ? "border-green-500/30 bg-green-500/5 text-green-400"
                : "border-red-500/30 bg-red-500/5 text-red-400"
            )}
          >
            <div className="font-semibold mb-2">
              {result.success ? "Square-Off Complete" : "Square-Off Failed"}
            </div>
            <div className="space-y-1 text-xs">
              <div>Symbols squared off: {result.symbolsSquaredOff}</div>
              <div>Strategies paused: {result.strategiesPaused}</div>
              <div>
                Kill switch:{" "}
                {result.killSwitchActivated ? "Activated" : "Not activated"}
              </div>
              {result.source && (
                <div className="text-muted-foreground">
                  Source: {result.source}
                </div>
              )}
              {result.details && result.details.length > 0 && (
                <div className="mt-2 space-y-0.5">
                  {result.details.map((d, i) => (
                    <div key={i} className="font-mono">
                      Symbol {d.symbolId}: {d.closingSide}{" "}
                      {Math.abs(d.position)} (was {d.position})
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Confirmation flow */}
        {showConfirm ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
              <p className="text-sm font-semibold text-red-400 mb-2">
                ⚠ This will close ALL positions, pause ALL strategies, and
                activate the kill switch.
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Type <span className="font-mono font-semibold text-red-400">SQUARE OFF</span> to
                confirm:
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type SQUARE OFF"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500/50"
                autoFocus
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Button
                onClick={handleSquareOffAll}
                disabled={!canConfirm || loading}
                variant="danger"
                size="default"
                className="font-semibold"
              >
                {loading ? "Squaring Off..." : "CONFIRM SQUARE OFF ALL"}
              </Button>
              <Button variant="ghost" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            onClick={() => {
              setResult(null);
              setShowConfirm(true);
            }}
            variant="danger"
            size="default"
            className="bg-amber-600 hover:bg-amber-700 font-semibold"
          >
            {totalPositionCount === 0
              ? "Square Off All & Pause Strategies"
              : `Square Off All (${totalPositionCount} position${totalPositionCount !== 1 ? "s" : ""})`}
          </Button>
        )}
    </div>
  );
}

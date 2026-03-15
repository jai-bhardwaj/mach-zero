"use client";

import { useState } from "react";
import type { StrategyConfig, StrategyStatus, SymbolState, TradingMode } from "@/types";
import { STATUS_TRANSITIONS } from "@/types";
import { formatPrice, formatPnl, formatQuantity, pnlColor, cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Props {
  strategy: StrategyConfig;
  liveData?: SymbolState;
  onStatusChange: (id: string, status: StrategyStatus, liveConfirm?: boolean) => void;
  onModeChange: (id: string, targetMode: TradingMode) => void;
  onSquareOff: (id: string) => void;
  onEdit: (strategy: StrategyConfig) => void;
  onDelete: (id: string) => void;
}

const STATUS_DOT_COLOR: Record<StrategyStatus, string> = {
  RUNNING: "bg-green-400",
  PAUSED: "bg-yellow-400",
  STOPPED: "bg-zinc-400",
  PENDING: "bg-blue-400",
};

export function StrategyCard({
  strategy,
  liveData,
  onStatusChange,
  onModeChange,
  onSquareOff,
  onEdit,
  onDelete,
}: Props) {
  const [confirmAction, setConfirmAction] = useState<StrategyStatus | "DELETE" | "GO_LIVE" | "GO_MOCK" | "SQUARE_OFF" | null>(null);
  const allowedTransitions = STATUS_TRANSITIONS[strategy.status] ?? [];
  const canDelete = strategy.status === "STOPPED" || strategy.status === "PENDING";
  const tradingMode = strategy.tradingMode ?? "MOCK";

  const handleConfirm = () => {
    if (!confirmAction) return;
    if (confirmAction === "DELETE") {
      onDelete(strategy.id);
    } else if (confirmAction === "GO_LIVE") {
      onModeChange(strategy.id, "LIVE");
    } else if (confirmAction === "GO_MOCK") {
      onModeChange(strategy.id, "MOCK");
    } else if (confirmAction === "SQUARE_OFF") {
      onSquareOff(strategy.id);
    } else {
      onStatusChange(strategy.id, confirmAction);
    }
    setConfirmAction(null);
  };

  const isLiveStart = tradingMode === "LIVE" && confirmAction === "RUNNING";
  const isGoLive = confirmAction === "GO_LIVE";
  const canGoLive = tradingMode === "MOCK" && strategy.status !== "STOPPED";
  const canGoMock = tradingMode === "LIVE" && strategy.status === "STOPPED";
  const canSquareOff = strategy.status === "RUNNING" || strategy.status === "PAUSED";
  const isSquareOff = confirmAction === "SQUARE_OFF";

  return (
    <Card>
      <CardContent className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">{strategy.name}</h3>
            <div className="mt-1 text-xs text-muted-foreground">
              {strategy.type} &middot; {strategy.symbolName} &middot;{" "}
              {strategy.venue}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs">
              <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT_COLOR[strategy.status])} />
              {strategy.status}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  tradingMode === "LIVE" ? "bg-red-400 animate-pulse" : "bg-blue-400"
                )}
              />
              {tradingMode}
            </span>
          </div>
        </div>

        {/* Live Metrics */}
        {liveData && (
          <div className="grid grid-cols-2 gap-2 border border-border/50 rounded-md px-2 py-1.5 sm:grid-cols-4">
            <div className="text-center">
              <div className="text-[10px] text-muted-foreground">Position</div>
              <div
                className={cn(
                  "text-xs font-mono font-semibold tabular-nums",
                  liveData.position > 0
                    ? "text-positive"
                    : liveData.position < 0
                    ? "text-negative"
                    : "text-muted-foreground"
                )}
              >
                {formatQuantity(liveData.position)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-muted-foreground">Unrealized</div>
              <div className={cn("text-xs font-mono font-semibold tabular-nums", pnlColor(liveData.unrealizedPnl))}>
                {formatPnl(liveData.unrealizedPnl)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-muted-foreground">Realized</div>
              <div className={cn("text-xs font-mono font-semibold tabular-nums", pnlColor(liveData.realizedPnl))}>
                {formatPnl(liveData.realizedPnl)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-muted-foreground">Fills</div>
              <div className="text-xs font-mono font-semibold tabular-nums">
                {liveData.fillCount}/{liveData.orderCount}
              </div>
            </div>
          </div>
        )}

        {/* Capital allocation bar */}
        {strategy.allocation && (
          <div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Capital: {formatPrice(strategy.allocation.allocatedAmt)}</span>
              <span>Margin: {formatPrice(strategy.allocation.usedMargin)}</span>
            </div>
            <div className="mt-1 h-1 w-full rounded-full bg-muted">
              <div
                className="h-1 rounded-full bg-primary transition-all"
                style={{
                  width: `${
                    strategy.allocation.allocatedAmt > 0
                      ? Math.min(
                          (strategy.allocation.usedMargin /
                            strategy.allocation.allocatedAmt) *
                            100,
                          100
                        )
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Parameters */}
        <div className="grid grid-cols-2 gap-1.5 text-xs border border-border/50 rounded-md px-2 py-1.5">
          {Object.entries(strategy.params).map(([key, value]) => (
            <div
              key={key}
              className="flex justify-between px-1 py-0.5"
            >
              <span className="text-muted-foreground">{key}</span>
              <span className="font-mono tabular-nums">{String(value)}</span>
            </div>
          ))}
        </div>

        {/* Risk limits */}
        {(strategy.maxPositionLimit || strategy.maxOrderRate || strategy.maxDrawdown) && (
          <div className="flex flex-wrap gap-2">
            {strategy.maxPositionLimit && (
              <Badge variant="warning">MaxPos: {strategy.maxPositionLimit}</Badge>
            )}
            {strategy.maxOrderRate && (
              <Badge variant="warning">MaxRate: {strategy.maxOrderRate}/s</Badge>
            )}
            {strategy.maxDrawdown && (
              <Badge variant="warning">MaxDD: {formatPrice(strategy.maxDrawdown)}</Badge>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          {confirmAction ? (
            <div className="flex flex-wrap items-center gap-2 w-full">
              <span className="text-xs text-muted-foreground">
                {confirmAction === "DELETE"
                  ? "Delete this strategy?"
                  : isSquareOff
                  ? "Close all positions for this strategy? A market order will be sent."
                  : isGoLive
                  ? "Switch to LIVE? Real orders will be sent to broker."
                  : isLiveStart
                  ? "Start in LIVE mode? Orders will be sent to broker."
                  : confirmAction === "GO_MOCK"
                  ? "Switch back to Paper Trading?"
                  : `${confirmAction} strategy?`}
              </span>
              <Button
                size="xs"
                variant={isLiveStart || isGoLive || isSquareOff ? "danger" : "default"}
                onClick={handleConfirm}
              >
                Confirm
              </Button>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setConfirmAction(null)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <>
              {allowedTransitions.includes("RUNNING") && (
                <Button
                  size="xs"
                  variant={tradingMode === "LIVE" ? "danger" : "success"}
                  onClick={() => setConfirmAction("RUNNING")}
                >
                  {strategy.status === "PAUSED"
                    ? "Resume"
                    : strategy.status === "STOPPED"
                    ? "Restart"
                    : "Start"}
                </Button>
              )}
              {allowedTransitions.includes("PAUSED") && (
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => setConfirmAction("PAUSED")}
                >
                  Pause
                </Button>
              )}
              {allowedTransitions.includes("STOPPED") && (
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => setConfirmAction("STOPPED")}
                >
                  Stop
                </Button>
              )}
              <Button
                size="xs"
                variant="outline"
                onClick={() => onEdit(strategy)}
              >
                Edit
              </Button>
              {canSquareOff && (
                <Button
                  size="xs"
                  variant="danger"
                  className="bg-amber-600 hover:bg-amber-700"
                  onClick={() => setConfirmAction("SQUARE_OFF")}
                >
                  Square Off
                </Button>
              )}
              {canGoLive && (
                <Button
                  size="xs"
                  variant="danger"
                  onClick={() => setConfirmAction("GO_LIVE")}
                >
                  Go Live
                </Button>
              )}
              {canGoMock && (
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => setConfirmAction("GO_MOCK")}
                >
                  Switch to Mock
                </Button>
              )}
              {canDelete && (
                <Button
                  size="xs"
                  variant="ghost"
                  className="ml-auto text-red-500 hover:text-red-600 dark:text-red-400"
                  onClick={() => setConfirmAction("DELETE")}
                >
                  Delete
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

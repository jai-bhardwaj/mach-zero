"use client";

import type { StrategyTemplate } from "@/types";
import {
  STRATEGY_CATEGORIES,
  RISK_LEVEL_STYLES,
  SYMBOL_MAP,
  STRATEGY_TYPES,
} from "@/types";
import { formatPrice } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Props {
  template: StrategyTemplate;
  onSubscribe: (template: StrategyTemplate) => void;
  onClose: () => void;
}

const RISK_BADGE: Record<string, "running" | "warning" | "destructive"> = {
  LOW: "running",
  MEDIUM: "warning",
  HIGH: "destructive",
};

export function MarketplaceDetailModal({
  template,
  onSubscribe,
  onClose,
}: Props) {
  const cat = STRATEGY_CATEGORIES[template.category];
  const risk = RISK_LEVEL_STYLES[template.riskLevel];
  const stratType = STRATEGY_TYPES[template.type];
  const subscriberCount = template._count?.subscriptions ?? 0;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle>{template.name}</DialogTitle>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {stratType?.label ?? template.type}
                </span>
                <span className="text-xs text-muted-foreground/60">
                  v{template.version}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {template.featured && (
                <Badge variant="default">Featured</Badge>
              )}
              {template.isSubscribed && (
                <Badge variant="running">Subscribed</Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Category + Risk + Subscribers */}
        <div className="flex items-center gap-3">
          <Badge variant="secondary">{cat.label}</Badge>
          <Badge variant={RISK_BADGE[template.riskLevel] ?? "warning"}>
            {risk.label}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {subscriberCount} subscriber{subscriberCount !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground">
          {template.longDescription ?? template.description}
        </p>

        {/* Performance Metrics */}
        <div>
          <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
            Performance
          </h3>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded bg-muted px-3 py-2 text-center">
              <div className="text-[10px] text-muted-foreground">Return</div>
              <div
                className={`text-sm font-mono tabular-nums font-semibold ${
                  template.returnPct >= 0 ? "text-positive" : "text-negative"
                }`}
              >
                {template.returnPct >= 0 ? "+" : ""}
                {template.returnPct.toFixed(1)}%
              </div>
            </div>
            <div className="rounded bg-muted px-3 py-2 text-center">
              <div className="text-[10px] text-muted-foreground">Win Rate</div>
              <div className="text-sm font-mono tabular-nums font-semibold text-foreground">
                {template.winRate.toFixed(1)}%
              </div>
            </div>
            <div className="rounded bg-muted px-3 py-2 text-center">
              <div className="text-[10px] text-muted-foreground">Sharpe Ratio</div>
              <div className="text-sm font-mono tabular-nums font-semibold text-foreground">
                {template.sharpeRatio.toFixed(2)}
              </div>
            </div>
            <div className="rounded bg-muted px-3 py-2 text-center">
              <div className="text-[10px] text-muted-foreground">Max Drawdown</div>
              <div className="text-sm font-mono tabular-nums font-semibold text-red-600 dark:text-red-400">
                -{formatPrice(template.maxDrawdown)}
              </div>
            </div>
            <div className="rounded bg-muted px-3 py-2 text-center">
              <div className="text-[10px] text-muted-foreground">Total Trades</div>
              <div className="text-sm font-mono tabular-nums font-semibold text-foreground">
                {template.totalTrades.toLocaleString()}
              </div>
            </div>
            <div className="rounded bg-muted px-3 py-2 text-center">
              <div className="text-[10px] text-muted-foreground">Min Capital</div>
              <div className="text-sm font-mono tabular-nums font-semibold text-foreground">
                {formatPrice(template.minCapital)}
              </div>
            </div>
          </div>
        </div>

        {/* Supported Symbols */}
        <div>
          <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
            Supported Symbols
          </h3>
          <div className="flex flex-wrap gap-2">
            {template.symbolIds.map((sid) => {
              const sym = SYMBOL_MAP[sid];
              return (
                <span
                  key={sid}
                  className="rounded bg-muted px-2 py-1 text-xs text-foreground"
                >
                  {sym?.name ?? `SYM-${sid}`}{" "}
                  <span className="text-muted-foreground">({sym?.venue})</span>
                </span>
              );
            })}
          </div>
        </div>

        {/* Default Parameters */}
        <div>
          <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
            Strategy Parameters
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(template.params).map(([key, value]) => (
              <div
                key={key}
                className="flex items-center justify-between rounded bg-muted px-3 py-1.5"
              >
                <span className="text-xs text-muted-foreground">{key}</span>
                <span className="text-xs font-mono tabular-nums text-foreground">
                  {String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter>
          <DialogClose render={<Button variant="ghost" />}>
            Close
          </DialogClose>
          {!template.isSubscribed && (
            <Button onClick={() => onSubscribe(template)}>
              Subscribe
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import type { StrategyTemplate } from "@/types";
import { STRATEGY_CATEGORIES, RISK_LEVEL_STYLES, SYMBOL_MAP } from "@/types";
import { formatPrice } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Props {
  template: StrategyTemplate;
  onSubscribe: (template: StrategyTemplate) => void;
  onViewDetails: (template: StrategyTemplate) => void;
}

const RISK_BADGE: Record<string, "running" | "warning" | "destructive"> = {
  LOW: "running",
  MEDIUM: "warning",
  HIGH: "destructive",
};

export function MarketplaceTemplateCard({
  template,
  onSubscribe,
  onViewDetails,
}: Props) {
  const cat = STRATEGY_CATEGORIES[template.category];
  const risk = RISK_LEVEL_STYLES[template.riskLevel];
  const subscriberCount = template._count?.subscriptions ?? 0;

  return (
    <Card
      className="cursor-pointer transition-colors hover:border-zinc-600"
      onClick={() => onViewDetails(template)}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold text-foreground">
              {template.name}
            </h3>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {template.type} &middot; v{template.version}
            </div>
          </div>
          <div className="ml-2 flex flex-shrink-0 items-center gap-1.5">
            {template.featured && (
              <Badge variant="default">Featured</Badge>
            )}
            {template.isSubscribed && (
              <Badge variant="running">Subscribed</Badge>
            )}
          </div>
        </div>

        {/* Category + Risk badges */}
        <div className="mt-2 flex items-center gap-2">
          <Badge variant="secondary">{cat.label}</Badge>
          <Badge variant={RISK_BADGE[template.riskLevel] ?? "warning"}>
            {risk.label}
          </Badge>
        </div>

        {/* Description */}
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
          {template.description}
        </p>

        {/* Supported Symbols */}
        <div className="mt-2 flex flex-wrap gap-1">
          {template.symbolIds.map((sid) => {
            const sym = SYMBOL_MAP[sid];
            return (
              <span
                key={sid}
                className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                {sym?.name ?? `SYM-${sid}`}
              </span>
            );
          })}
        </div>

        {/* Performance Metrics */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          <div className="rounded bg-muted px-2 py-1.5 text-center">
            <div className="text-[10px] text-muted-foreground">Return</div>
            <div
              className={`text-xs font-mono tabular-nums font-semibold ${
                template.returnPct >= 0 ? "text-positive" : "text-negative"
              }`}
            >
              {template.returnPct >= 0 ? "+" : ""}
              {template.returnPct.toFixed(1)}%
            </div>
          </div>
          <div className="rounded bg-muted px-2 py-1.5 text-center">
            <div className="text-[10px] text-muted-foreground">Win Rate</div>
            <div className="text-xs font-mono tabular-nums font-semibold text-foreground">
              {template.winRate.toFixed(1)}%
            </div>
          </div>
          <div className="rounded bg-muted px-2 py-1.5 text-center">
            <div className="text-[10px] text-muted-foreground">Max DD</div>
            <div className="text-xs font-mono tabular-nums font-semibold text-red-600 dark:text-red-400">
              -{formatPrice(template.maxDrawdown)}
            </div>
          </div>
          <div className="rounded bg-muted px-2 py-1.5 text-center">
            <div className="text-[10px] text-muted-foreground">Sharpe</div>
            <div className="text-xs font-mono tabular-nums font-semibold text-foreground">
              {template.sharpeRatio.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
          <div className="text-[10px] text-muted-foreground">
            Min: {formatPrice(template.minCapital)} &middot; {subscriberCount}{" "}
            subscriber{subscriberCount !== 1 ? "s" : ""}
          </div>
          {template.isSubscribed ? (
            <Button
              variant="ghost"
              size="xs"
              disabled
              onClick={(e) => e.stopPropagation()}
            >
              Subscribed
            </Button>
          ) : (
            <Button
              size="xs"
              onClick={(e) => {
                e.stopPropagation();
                onSubscribe(template);
              }}
            >
              Subscribe
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

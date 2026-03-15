"use client";

import { useState } from "react";
import type { StrategyTemplate, StrategyCategory, RiskLevel } from "@/types";
import { STRATEGY_CATEGORIES, RISK_LEVEL_STYLES } from "@/types";
import { MarketplaceTemplateCard } from "@/components/marketplace/MarketplaceTemplateCard";
import { MarketplaceDetailModal } from "@/components/marketplace/MarketplaceDetailModal";
import { MarketplaceSubscribeModal } from "@/components/marketplace/MarketplaceSubscribeModal";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ALL_CATEGORIES: (StrategyCategory | "ALL")[] = [
  "ALL",
  "MARKET_MAKING",
  "MOMENTUM",
  "ARBITRAGE",
  "MEAN_REVERSION",
  "TREND_FOLLOWING",
  "STATISTICAL",
];

const ALL_RISK_LEVELS: (RiskLevel | "ALL")[] = ["ALL", "LOW", "MEDIUM", "HIGH"];

interface Props {
  initialTemplates: StrategyTemplate[];
  accounts: { id: string; name: string; venue: string }[];
}

export function MarketplaceClient({ initialTemplates, accounts }: Props) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [categoryFilter, setCategoryFilter] = useState<
    StrategyCategory | "ALL"
  >("ALL");
  const [riskFilter, setRiskFilter] = useState<RiskLevel | "ALL">("ALL");
  const [selectedTemplate, setSelectedTemplate] =
    useState<StrategyTemplate | null>(null);
  const [subscribingTemplate, setSubscribingTemplate] =
    useState<StrategyTemplate | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshTemplates = async () => {
    try {
      const res = await fetch("/api/marketplace");
      if (res.ok) setTemplates(await res.json());
    } catch {
      // Polling failures are expected when offline
    }
  };

  const handleSubscribe = async (
    templateId: string,
    accountId: string,
    symbolId: number
  ) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/marketplace/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, accountId, symbolId }),
      });
      if (res.ok) {
        setSubscribingTemplate(null);
        setSelectedTemplate(null);
        refreshTemplates();
      } else {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        setError(err.error ?? "Failed to subscribe to strategy");
      }
    } catch {
      setError("Failed to subscribe. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = templates.filter((t) => {
    if (categoryFilter !== "ALL" && t.category !== categoryFilter) return false;
    if (riskFilter !== "ALL" && t.riskLevel !== riskFilter) return false;
    return true;
  });

  const categoryCounts = ALL_CATEGORIES.reduce(
    (acc, c) => {
      acc[c] =
        c === "ALL"
          ? templates.length
          : templates.filter((t) => t.category === c).length;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <>
      {/* Error Banner */}
      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-500/30 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-xs text-red-400/70 hover:text-red-400"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {ALL_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategoryFilter(c)}
            className={cn(
              "px-3 py-2 text-xs transition-colors",
              categoryFilter === c
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {c === "ALL" ? "All" : STRATEGY_CATEGORIES[c].label}{" "}
            <Badge variant="secondary" className="ml-1">{categoryCounts[c]}</Badge>
          </button>
        ))}
      </div>

      {/* Risk Level Filter */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Risk:</span>
        {ALL_RISK_LEVELS.map((r) => (
          <button
            key={r}
            onClick={() => setRiskFilter(r)}
            className={cn(
              "rounded-full px-3 py-1 text-xs transition-colors",
              riskFilter === r
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {r === "ALL" ? "All" : RISK_LEVEL_STYLES[r].label}
          </button>
        ))}
      </div>

      {/* Template Grid */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            {templates.length === 0
              ? "No strategies available in the marketplace yet."
              : "No strategies match the selected filters."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t) => (
            <MarketplaceTemplateCard
              key={t.id}
              template={t}
              onSubscribe={setSubscribingTemplate}
              onViewDetails={setSelectedTemplate}
            />
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedTemplate && (
        <MarketplaceDetailModal
          template={selectedTemplate}
          onSubscribe={(t) => {
            setSelectedTemplate(null);
            setSubscribingTemplate(t);
          }}
          onClose={() => setSelectedTemplate(null)}
        />
      )}

      {/* Subscribe Modal */}
      {subscribingTemplate && (
        <MarketplaceSubscribeModal
          template={subscribingTemplate}
          accounts={accounts}
          onConfirm={handleSubscribe}
          onClose={() => setSubscribingTemplate(null)}
          submitting={submitting}
        />
      )}
    </>
  );
}

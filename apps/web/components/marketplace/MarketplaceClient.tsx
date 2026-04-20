"use client";

import { useState } from "react";
import { toast } from "sonner";
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
        toast.success("Subscribed — strategy created in MOCK mode");
        setSubscribingTemplate(null);
        setSelectedTemplate(null);
        refreshTemplates();
      } else {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        toast.error(err.error ?? "Failed to subscribe to strategy");
      }
    } catch {
      toast.error("Failed to subscribe. Please try again.");
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
          {/* Create Custom Strategy CTA */}
          <a
            href="/strategies"
            className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-card/30 p-6 text-center transition-colors hover:bg-muted/50 hover:border-border min-h-[200px]"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
            </div>
            <p className="text-sm font-medium text-foreground">Create Custom Strategy</p>
            <p className="mt-1 text-[11px] text-muted-foreground max-w-[200px]">
              Build your own strategy with custom parameters and risk limits.
            </p>
          </a>
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

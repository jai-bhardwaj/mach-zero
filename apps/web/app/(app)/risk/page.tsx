"use client";

import { useState } from "react";
import { KillSwitchPanel } from "@/components/risk/KillSwitchPanel";
import { SquareOffPanel } from "@/components/risk/SquareOffPanel";
import { RiskMetrics } from "@/components/risk/RiskMetrics";
import { RiskEventsTable } from "@/components/trades/RiskEventsTable";
import { useRiskEvents } from "@/hooks/useTrades";
import { PageHeader } from "@/components/ui/page-header";
import type { SortingState } from "@/types";

export default function RiskPage() {
  if (typeof document !== 'undefined') document.title = 'Risk | Mach-Zero';
  const [sorting, setSorting] = useState<SortingState[]>([
    { id: "timestamp", desc: true },
  ]);

  const { events, isLoading } = useRiskEvents({
    limit: 100,
    sort: sorting[0]?.id,
    dir: sorting[0]?.desc ? "desc" : "asc",
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="Risk Management" />
      <KillSwitchPanel />
      <SquareOffPanel />
      <div className="grid grid-cols-1 gap-3 sm:gap-6 lg:grid-cols-2">
        <RiskMetrics />
        <div>
          <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-3">
            Recent Risk Events
          </h2>
          <RiskEventsTable
            events={events}
            isLoading={isLoading}
            sorting={sorting}
            onSortingChange={setSorting}
          />
        </div>
      </div>
    </div>
  );
}

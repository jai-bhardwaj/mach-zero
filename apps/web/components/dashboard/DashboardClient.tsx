"use client";

import { usePositions } from "@/hooks/usePositions";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { PositionsTable } from "@/components/dashboard/PositionsTable";
import { MarketDataPanel } from "@/components/dashboard/MarketDataPanel";
import { PnLChart } from "@/components/dashboard/PnLChart";
import { GettingStarted } from "@/components/dashboard/GettingStarted";

interface Props {
  hasAccounts: boolean;
  hasStrategies: boolean;
}

export function DashboardClient({ hasAccounts, hasStrategies }: Props) {
  const { symbols, connected } = usePositions();
  const showGettingStarted = !hasAccounts || !hasStrategies;

  return (
    <div className="space-y-4 sm:space-y-6">
      {showGettingStarted && (
        <GettingStarted
          hasAccounts={hasAccounts}
          hasStrategies={hasStrategies}
        />
      )}
      <SummaryCards symbols={symbols} connected={connected} />
      <div>
        <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-3">
          Positions
        </h3>
        <PositionsTable symbols={symbols} />
      </div>
      <PnLChart />
      <div>
        <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-3">
          Market Data
        </h3>
        <MarketDataPanel symbols={symbols} />
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useTradingMode } from "@/contexts/TradingModeContext";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function TradingModeSettings() {
  const { hasLiveStrategies, liveCount, mockCount, loading } = useTradingMode();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trading Mode</CardTitle>
        <CardDescription>
          Trading mode is now configured per-strategy. Switch individual strategies between MOCK and LIVE from the Strategies page.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <Badge variant={hasLiveStrategies ? "live" : "mock"} className="gap-1.5">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                hasLiveStrategies ? "bg-red-400 animate-pulse" : "bg-blue-400"
              )}
            />
            {loading
              ? "Loading..."
              : hasLiveStrategies
              ? `${liveCount} Live, ${mockCount} Mock`
              : "All Paper Trading"}
          </Badge>
        </div>

        <div className="text-sm text-muted-foreground">
          {hasLiveStrategies
            ? `${liveCount} ${liveCount === 1 ? "strategy is" : "strategies are"} in LIVE mode (real orders). ${mockCount} ${mockCount === 1 ? "strategy is" : "strategies are"} in MOCK mode (paper trading).`
            : "All strategies are running in paper trading mode. No real orders are being sent."}
        </div>

        <Link
          href="/strategies"
          className="inline-flex items-center text-sm text-accent hover:underline"
        >
          Manage strategies &rarr;
        </Link>
      </CardContent>
    </Card>
  );
}

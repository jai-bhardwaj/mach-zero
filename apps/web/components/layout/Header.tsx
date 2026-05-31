"use client";

import { useEffect, useState } from "react";
import type { KillSwitchStatus } from "@/types";
import { useTradingMode } from "@/contexts/TradingModeContext";
import { cn } from "@/lib/utils";
import { Circle } from "lucide-react";
import { MobileSidebar } from "@/components/layout/MobileSidebar";

export function Header() {
  const [killSwitch, setKillSwitch] = useState<boolean | null>(null);
  // "fallback" source = the API couldn't reach the C++ risk monitor, so the
  // status isn't authoritative; show "Status unknown" rather than "Normal".
  const [source, setSource] = useState<string | null>(null);
  const { hasLiveStrategies, liveCount } = useTradingMode();

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/kill-switch");
        if (res.ok) {
          const data: KillSwitchStatus = await res.json();
          setKillSwitch(data.killSwitch);
          setSource((data as { source?: string }).source ?? null);
        }
      } catch {
        setKillSwitch(null);
        setSource(null);
      }
    };

    check();
    const interval = setInterval(check, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="flex h-11 items-center justify-between border-b border-border/50 bg-background px-3 sm:px-4">
      <div className="flex items-center gap-2">
        {/* Mobile hamburger menu */}
        <MobileSidebar />
      </div>

      <div className="flex items-center gap-3">
        {/* Trading mode dot */}
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full shrink-0",
              hasLiveStrategies ? "bg-red-400 animate-pulse" : "bg-blue-400"
            )}
          />
          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            {hasLiveStrategies ? `${liveCount} LIVE` : "MOCK"}
          </span>
        </div>

        {/* Kill switch status dot */}
        <div className="flex items-center gap-1.5">
          <Circle
            className={cn(
              "h-2 w-2",
              killSwitch === null
                ? "fill-zinc-400 text-zinc-400 dark:fill-zinc-600 dark:text-zinc-600"
                : killSwitch
                ? "fill-red-500 text-red-500 animate-pulse"
                : source === "fallback"
                ? "fill-orange-400 text-orange-400"
                : "fill-green-500 text-green-500"
            )}
          />
          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            {killSwitch === null
              ? "Disconnected"
              : killSwitch
              ? "KILL SWITCH"
              : source === "fallback"
              ? "Status unknown"
              : "Normal"}
          </span>
        </div>
      </div>
    </header>
  );
}

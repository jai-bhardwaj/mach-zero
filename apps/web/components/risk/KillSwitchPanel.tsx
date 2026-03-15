"use client";

import { useEffect, useState } from "react";
import { useKillSwitch } from "@/hooks/useKillSwitch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function KillSwitchPanel() {
  const { active, loading, refresh, toggle } = useKillSwitch();
  const [confirmAction, setConfirmAction] = useState<"on" | "off" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleToggle = async () => {
    if (!confirmAction) return;
    try {
      await toggle(confirmAction);
    } catch {
      setError(`Failed to ${confirmAction === "on" ? "activate" : "deactivate"} kill switch`);
    }
    setConfirmAction(null);
  };

  return (
    <div className="rounded-lg border border-border/50 p-4 space-y-3">
      <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Kill Switch</h2>

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

      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-block h-1.5 w-1.5 rounded-full",
            active === null
              ? "bg-muted-foreground"
              : active
              ? "bg-red-500 animate-pulse"
              : "bg-green-500"
          )}
        />
        <span
          className={cn(
            "text-sm",
            active === null
              ? "text-muted-foreground"
              : active
              ? "text-red-600 dark:text-red-400"
              : "text-green-600 dark:text-green-400"
          )}
        >
          {active === null
            ? "Disconnected"
            : active
            ? "Kill Switch Active — All Orders Halted"
            : "System Normal — Orders Flowing"}
        </span>
      </div>

      {confirmAction ? (
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="text-xs text-muted-foreground">
            Confirm {confirmAction === "on" ? "ACTIVATE" : "DEACTIVATE"} kill
            switch?
          </span>
          <Button
            onClick={handleToggle}
            disabled={loading}
            size="sm"
            variant={confirmAction === "on" ? "danger" : "success"}
          >
            {loading ? "..." : "Confirm"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmAction(null)}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          <Button
            onClick={() => setConfirmAction("on")}
            disabled={active === true}
            variant="danger"
            size="default"
          >
            Activate Kill Switch
          </Button>
          <Button
            onClick={() => setConfirmAction("off")}
            disabled={active === false || active === null}
            variant="success"
            size="default"
          >
            Deactivate
          </Button>
        </div>
      )}
    </div>
  );
}

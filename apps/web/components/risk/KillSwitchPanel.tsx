"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useKillSwitch } from "@/hooks/useKillSwitch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function KillSwitchPanel() {
  const { active, source, loading, refresh, toggle } = useKillSwitch();
  const [confirmAction, setConfirmAction] = useState<"on" | "off" | null>(null);

  // The API serves local fallback state when it can't reach the C++ risk
  // monitor. In that case we can't truthfully claim "System Normal" — the
  // authoritative kill-switch backend is unreachable.
  const degraded = source === "fallback";

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleToggle = async () => {
    if (!confirmAction) return;
    const ok = await toggle(confirmAction);
    if (ok) {
      toast.success(
        confirmAction === "on"
          ? "Kill switch activated — all orders halted"
          : "Kill switch deactivated — orders flowing"
      );
    } else {
      toast.error(
        `Failed to ${confirmAction === "on" ? "activate" : "deactivate"} kill switch`
      );
    }
    setConfirmAction(null);
  };

  return (
    <div className="rounded-lg border border-border/50 p-4 space-y-3">
      <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Kill Switch</h2>

      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-block h-1.5 w-1.5 rounded-full",
            active === null
              ? "bg-muted-foreground"
              : active
              ? "bg-red-500 animate-pulse"
              : degraded
              ? "bg-orange-400"
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
              : degraded
              ? "text-orange-600 dark:text-orange-400"
              : "text-green-600 dark:text-green-400"
          )}
        >
          {active === null
            ? "Disconnected"
            : active
            ? "Kill Switch Active — All Orders Halted"
            : degraded
            ? "Status unknown — risk monitor unreachable"
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

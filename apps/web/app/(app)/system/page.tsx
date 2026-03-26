"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";

interface ServiceStatus {
  name: string;
  status: string;
  latencyMs: number;
}

interface HealthData {
  status: string;
  services: ServiceStatus[];
  timestamp: string;
}

const STATUS_DOT: Record<string, string> = {
  up: "bg-green-500",
  healthy: "bg-green-500",
  degraded: "bg-yellow-500",
};

export default function SystemPage() {
  if (typeof document !== 'undefined') document.title = 'System | Mach-Zero';
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = async () => {
    try {
      const res = await fetch("/api/health");
      if (res.ok) setHealth(await res.json());
    } catch {
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="System Health" />

      {loading ? (
        <p className="text-xs text-muted-foreground">Checking services...</p>
      ) : !health ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <p className="text-sm text-red-600 dark:text-red-400">
            Health check endpoint unreachable.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1.5 text-sm">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                health.status === "healthy" ? "bg-green-400" : "bg-yellow-400"
              )}
            />
            <span className={cn(
              health.status === "healthy" ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400"
            )}>
              System: {health.status.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {health.services.map((svc) => (
              <div
                key={svc.name}
                className="rounded-lg border border-border/50 p-3 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[svc.status] ?? "bg-red-500")} />
                  <span className="text-sm font-medium">{svc.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {svc.status}
                  </span>
                  <span className="text-xs font-mono tabular-nums text-muted-foreground">
                    {svc.latencyMs}ms
                  </span>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-muted-foreground">
            Last check: {health.timestamp}
          </p>
        </>
      )}

      <div className="rounded-lg border border-border/50 p-4">
        <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-3">Architecture</h2>
        <pre className="text-xs text-muted-foreground overflow-x-auto">
{`┌─────────────┐     ┌───────────────┐     ┌──────────┐
│  Gateway     │────▶│  Engine       │────▶│ QuestDB  │
│  (Binance/   │     │  (Strategy +  │     │ (trades, │
│   NSE WS)    │     │   Risk)       │     │  orders) │
└─────────────┘     └───────────────┘     └──────────┘
                          │
                    ┌─────┴─────┐
                    │ Shared    │
                    │ Memory    │
                    │ (/dev/shm)│
                    └─────┬─────┘
                          │
                    ┌─────┴─────┐     ┌──────────┐
                    │ Python    │     │ Kill     │
                    │ Bridge    │     │ Switch   │
                    │ (WS:3002) │     │ (HTTP    │
                    └─────┬─────┘     │  :8080)  │
                          │           └────┬─────┘
                    ┌─────┴────────────────┴─────┐
                    │     Next.js Web App         │
                    │     (this dashboard)        │
                    └────────────────────────────┘`}
        </pre>
      </div>
    </div>
  );
}

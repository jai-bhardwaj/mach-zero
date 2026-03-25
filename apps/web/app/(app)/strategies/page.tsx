"use client";

import { useEffect, useState } from "react";
import type { StrategyConfig, StrategyStatus, CapitalPool, TradingMode, SquareOffResult } from "@/types";
import { usePositions } from "@/hooks/usePositions";
import { useTradingMode } from "@/contexts/TradingModeContext";
import { StrategyCard } from "@/components/strategies/StrategyCard";
import { StrategyConfigForm } from "@/components/strategies/StrategyConfigForm";
import { StrategyCreateForm } from "@/components/strategies/StrategyCreateForm";
import { CapitalPanel } from "@/components/strategies/CapitalPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<StrategyConfig[]>([]);
  const [pools, setPools] = useState<CapitalPool[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; name: string; venue: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<StrategyConfig | null>(null);
  const [creating, setCreating] = useState(false);
  const [squareOffAllConfirm, setSquareOffAllConfirm] = useState(false);
  const [squareOffAllLoading, setSquareOffAllLoading] = useState(false);
  const [squareOffAllResult, setSquareOffAllResult] = useState<SquareOffResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { symbols } = usePositions();
  const { refresh: refreshMode } = useTradingMode();

  const fetchAll = async () => {
    try {
      const [stratRes, poolRes, acctRes] = await Promise.all([
        fetch("/api/strategies"),
        fetch("/api/capital"),
        fetch("/api/accounts"),
      ]);
      if (stratRes.ok) setStrategies(await stratRes.json());
      if (poolRes.ok) setPools(await poolRes.json());
      if (acctRes.ok) {
        const accts = await acctRes.json();
        setAccounts(accts.map((a: { id: string; name: string; venue: string }) => ({
          id: a.id,
          name: a.name,
          venue: a.venue,
        })));
      }
    } catch {
      // Polling failures are expected when offline — don't show error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 10000);
    return () => clearInterval(interval);
  }, []);

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(t);
  }, [error]);

  const handleStatusChange = async (
    id: string,
    status: StrategyStatus,
    liveConfirm?: boolean
  ) => {
    try {
      const res = await fetch("/api/strategies", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, liveConfirm }),
      });

      if (res.status === 428) {
        const retryRes = await fetch("/api/strategies", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, status, liveConfirm: true }),
        });
        if (!retryRes.ok) {
          const err = await retryRes.json().catch(() => ({ error: "Unknown error" }));
          setError(err.error ?? "Failed to start strategy in LIVE mode");
          return;
        }
      } else if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        setError(err.error ?? "Failed to change strategy status");
        return;
      }
    } catch {
      setError("Failed to change strategy status. Please try again.");
      return;
    }
    fetchAll();
    refreshMode();
  };

  const handleSave = async (
    id: string,
    data: {
      params: Record<string, unknown>;
      maxPositionLimit: number | null;
      maxOrderRate: number | null;
      maxDrawdown: number | null;
      riskMultiplier: number;
    }
  ) => {
    try {
      const res = await fetch("/api/strategies", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...data }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        setError(err.error ?? "Failed to save strategy configuration");
        return;
      }
    } catch {
      setError("Failed to save strategy configuration. Please try again.");
      return;
    }
    setEditing(null);
    fetchAll();
  };

  const handleCreate = async (data: Record<string, unknown>) => {
    try {
      const res = await fetch("/api/strategies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        setError(err.error ?? "Failed to create strategy");
        return;
      }
    } catch {
      setError("Failed to create strategy. Please try again.");
      return;
    }
    setCreating(false);
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/strategies?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        setError(err.error ?? "Failed to delete strategy");
        return;
      }
    } catch {
      setError("Failed to delete strategy. Please try again.");
      return;
    }
    fetchAll();
    refreshMode();
  };

  const handleSquareOff = async (id: string) => {
    try {
      const res = await fetch("/api/square-off", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "strategy", strategyId: id }),
      });
      const result = await res.json();
      if (!result.success) {
        setError("Square-off failed for this strategy");
      }
    } catch {
      setError("Square-off request failed. Please try again.");
    }
    fetchAll();
    refreshMode();
  };

  const handleSquareOffAll = async () => {
    setSquareOffAllLoading(true);
    try {
      const res = await fetch("/api/square-off", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "tenant", activateKillSwitch: true }),
      });
      const result: SquareOffResult = await res.json();
      setSquareOffAllResult(result);
    } catch {
      setSquareOffAllResult({
        success: false,
        scope: "tenant",
        strategiesPaused: 0,
        killSwitchActivated: false,
        symbolsSquaredOff: 0,
        details: [],
        source: "error",
      });
    } finally {
      setSquareOffAllLoading(false);
      setSquareOffAllConfirm(false);
      fetchAll();
      refreshMode();
    }
  };

  const handleModeChange = async (id: string, targetMode: TradingMode) => {
    try {
      const res = await fetch("/api/strategies", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, tradingMode: targetMode }),
      });

      if (res.status === 428) {
        const retryRes = await fetch("/api/strategies", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, tradingMode: targetMode, liveConfirm: true }),
        });
        if (!retryRes.ok) {
          const err = await retryRes.json().catch(() => ({ error: "Unknown error" }));
          setError(err.error ?? "Failed to switch trading mode");
          return;
        }
      } else if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        setError(err.error ?? "Failed to switch trading mode");
        return;
      }
    } catch {
      setError("Failed to switch trading mode. Please try again.");
      return;
    }
    fetchAll();
    refreshMode();
  };

  const statusCounts = {
    ALL: strategies.length,
    RUNNING: strategies.filter((s) => s.status === "RUNNING").length,
    PAUSED: strategies.filter((s) => s.status === "PAUSED").length,
    STOPPED: strategies.filter((s) => s.status === "STOPPED").length,
    PENDING: strategies.filter((s) => s.status === "PENDING").length,
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Strategies" />
        <div className="text-muted-foreground">Loading strategies...</div>
      </div>
    );
  }

  const tenantId = strategies[0]?.tenantId ?? accounts[0]?.id ?? "";

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Error Banner */}
      {error && (
        <div className="flex flex-col gap-2 rounded-lg border border-red-500/30 bg-red-900/20 px-3 py-2.5 text-sm text-red-400 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3">
          <span className="text-xs sm:text-sm">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-xs text-red-400/70 hover:text-red-400"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <PageHeader
        title="Strategies"
        actions={
          <>
            {squareOffAllConfirm ? (
              <>
                <span className="text-xs text-red-400 font-medium">
                  Square off all positions & pause all strategies?
                </span>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={squareOffAllLoading}
                  onClick={handleSquareOffAll}
                >
                  {squareOffAllLoading ? "Squaring Off..." : "Confirm"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSquareOffAllConfirm(false)}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="danger"
                className="bg-amber-600 hover:bg-amber-700"
                onClick={() => {
                  setSquareOffAllResult(null);
                  setSquareOffAllConfirm(true);
                }}
              >
                Square Off All
              </Button>
            )}
            <Button onClick={() => setCreating(true)}>Create Strategy</Button>
          </>
        }
      />

      {/* Square Off All result */}
      {squareOffAllResult && (
        <div
          className={cn(
            "flex flex-col gap-2 rounded-lg border px-3 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3 sm:text-sm",
            squareOffAllResult.success
              ? "border-green-500/30 bg-green-500/5 text-green-400"
              : "border-red-500/30 bg-red-500/5 text-red-400"
          )}
        >
          <span>
            {squareOffAllResult.success
              ? `Square-off complete: ${squareOffAllResult.strategiesPaused} strategies paused, ${squareOffAllResult.symbolsSquaredOff} symbols squared off`
              : "Square-off failed"}
          </span>
          <button
            onClick={() => setSquareOffAllResult(null)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Capital Overview */}
      {pools.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Capital Pools
          </h2>
          <CapitalPanel pools={pools} />
        </div>
      )}

      {/* Status Filters */}
      <Tabs defaultValue="ALL">
        <TabsList variant="line">
          {(["ALL", "RUNNING", "PAUSED", "PENDING", "STOPPED"] as const).map(
            (s) => (
              <TabsTrigger key={s} value={s}>
                {s}
                <span className="text-[10px] text-muted-foreground ml-1">
                  {statusCounts[s]}
                </span>
              </TabsTrigger>
            )
          )}
        </TabsList>
        {(["ALL", "RUNNING", "PAUSED", "PENDING", "STOPPED"] as const).map(
          (s) => {
            const filtered =
              s === "ALL"
                ? strategies
                : strategies.filter((st) => st.status === s);
            return (
              <TabsContent key={s} value={s}>
                {filtered.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center">
                      {strategies.length === 0 ? (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-foreground">
                            No strategies yet
                          </p>
                          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                            Create a strategy to start algorithmic trading, or browse the Marketplace for pre-built strategies.
                          </p>
                          <div className="flex items-center justify-center gap-2 pt-2">
                            <a
                              href="/marketplace"
                              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                            >
                              Browse Marketplace
                            </a>
                          </div>
                        </div>
                      ) : (
                        <p className="text-muted-foreground">{`No ${s} strategies.`}</p>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {filtered.map((st) => (
                      <StrategyCard
                        key={st.id}
                        strategy={st}
                        liveData={symbols.find(
                          (sym) => sym.symbolId === st.symbolId
                        )}
                        onStatusChange={handleStatusChange}
                        onModeChange={handleModeChange}
                        onSquareOff={handleSquareOff}
                        onEdit={setEditing}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            );
          }
        )}
      </Tabs>

      {/* Modals */}
      {editing && (
        <StrategyConfigForm
          strategy={editing}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}
      {creating && (
        <StrategyCreateForm
          tenantId={tenantId}
          accounts={accounts}
          onSave={handleCreate}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  );
}

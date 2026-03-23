"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface HistoryEntry {
  id: string;
  configVersion: number;
  params: Record<string, unknown>;
  maxPositionLimit: number | null;
  maxOrderRate: number | null;
  maxDrawdown: number | null;
  riskMultiplier: number;
  changedBy: string | null;
  changedAt: string;
}

interface HistoryResponse {
  strategyId: string;
  strategyName: string;
  currentVersion: number;
  history: HistoryEntry[];
  error?: string;
}

interface Props {
  strategyId: string;
  currentVersion: number;
  children: React.ReactNode;
}

export function VersionHistoryModal({
  strategyId,
  currentVersion,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useSWR<HistoryResponse>(
    open ? `/api/strategies/${strategyId}/history` : null,
    fetcher
  );

  return (
    <>
      <span onClick={() => setOpen(true)} className="cursor-pointer">
        {children}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Version History
            <Badge variant="outline" className="text-xs">
              v{currentVersion}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
          {isLoading && (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-12 animate-pulse rounded-md bg-zinc-800"
                />
              ))}
            </div>
          )}

          {data?.error && (
            <p className="text-sm text-red-400">{data.error}</p>
          )}

          {data?.history?.length === 0 && (
            <p className="py-4 text-center text-sm text-zinc-500">
              No previous versions
            </p>
          )}

          {data?.history?.map((entry) => (
            <button
              key={entry.id}
              onClick={() =>
                setExpandedId(expandedId === entry.id ? null : entry.id)
              }
              className={cn(
                "w-full rounded-md border border-border bg-card p-3 text-left transition-colors hover:bg-zinc-800/50",
                expandedId === entry.id && "bg-zinc-800/50"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    v{entry.configVersion}
                  </Badge>
                  <span className="text-xs text-zinc-500">
                    {new Date(entry.changedAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {expandedId === entry.id && (
                <div className="mt-3 space-y-2 border-t border-border pt-2">
                  <div className="text-xs">
                    <span className="text-zinc-500">Parameters:</span>
                    <pre className="mt-1 max-h-32 overflow-auto rounded bg-zinc-900 p-2 text-[10px] text-zinc-300">
                      {JSON.stringify(entry.params, null, 2)}
                    </pre>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-zinc-500">Max Position:</span>{" "}
                      <span className="text-zinc-300">
                        {entry.maxPositionLimit ?? "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Max Order Rate:</span>{" "}
                      <span className="text-zinc-300">
                        {entry.maxOrderRate ?? "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Max Drawdown:</span>{" "}
                      <span className="text-zinc-300">
                        {entry.maxDrawdown ?? "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Risk Multiplier:</span>{" "}
                      <span className="text-zinc-300">
                        {entry.riskMultiplier}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

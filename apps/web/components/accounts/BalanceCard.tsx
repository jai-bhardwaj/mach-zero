"use client";

import useSWR from "swr";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Balance {
  asset: string;
  free: string;
  locked: string;
}

interface BalanceResponse {
  accountId: string;
  accountName: string;
  testnet: boolean;
  balances: Balance[];
  error?: string;
}

interface Props {
  accountId: string;
  onClose?: () => void;
}

export function BalanceCard({ accountId, onClose }: Props) {
  const { data, error, isLoading } = useSWR<BalanceResponse>(
    `/api/accounts/${accountId}/balance`,
    fetcher,
    { refreshInterval: 30000 }
  );

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-4 w-32 animate-pulse rounded bg-zinc-800" />
          {onClose && (
            <button onClick={onClose} className="text-xs text-zinc-500 hover:text-zinc-300">
              Close
            </button>
          )}
        </div>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-4 w-full animate-pulse rounded bg-zinc-800" />
        ))}
      </div>
    );
  }

  if (error || data?.error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-900/10 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-red-400">
            {data?.error ?? "Failed to load balances"}
          </p>
          {onClose && (
            <button onClick={onClose} className="text-xs text-zinc-500 hover:text-zinc-300">
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!data?.balances?.length) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-500">No balances found</p>
          {onClose && (
            <button onClick={onClose} className="text-xs text-zinc-500 hover:text-zinc-300">
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium text-zinc-200">Balances</h4>
          {data.testnet && (
            <span className="rounded bg-blue-900/30 px-1.5 py-0.5 text-[10px] font-medium text-blue-400">
              TESTNET
            </span>
          )}
        </div>
        {onClose && (
          <button onClick={onClose} className="text-xs text-zinc-500 hover:text-zinc-300">
            Close
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-zinc-500">
              <th className="pb-1.5 text-left font-medium">Asset</th>
              <th className="pb-1.5 text-right font-medium">Free</th>
              <th className="pb-1.5 text-right font-medium">Locked</th>
            </tr>
          </thead>
          <tbody>
            {data.balances.map((b) => (
              <tr key={b.asset} className="border-b border-border/50 last:border-0">
                <td className="py-1.5 font-medium text-zinc-200">{b.asset}</td>
                <td className={cn(
                  "py-1.5 text-right tabular-nums",
                  parseFloat(b.free) > 0 ? "text-green-400" : "text-zinc-500"
                )}>
                  {formatBalance(b.free)}
                </td>
                <td className={cn(
                  "py-1.5 text-right tabular-nums",
                  parseFloat(b.locked) > 0 ? "text-yellow-400" : "text-zinc-500"
                )}>
                  {formatBalance(b.locked)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatBalance(value: string): string {
  const num = parseFloat(value);
  if (num === 0) return "0";
  if (num >= 1) return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return num.toPrecision(4);
}

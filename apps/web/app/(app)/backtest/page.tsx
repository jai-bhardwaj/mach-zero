import { Suspense } from "react";
import { BacktestClient } from "@/components/backtest/BacktestClient";

export const metadata = { title: "Backtest | Mach-Zero" };
export default function BacktestPage() {
  return (
    <Suspense
      fallback={
        <div className="animate-pulse space-y-4 p-6">
          <div className="h-8 w-48 rounded bg-zinc-800" />
          <div className="h-48 rounded-lg bg-zinc-800" />
          <div className="h-64 rounded-lg bg-zinc-800" />
        </div>
      }
    >
      <BacktestClient />
    </Suspense>
  );
}

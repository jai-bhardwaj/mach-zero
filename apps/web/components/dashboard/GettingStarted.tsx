"use client";

import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface Props {
  hasAccounts: boolean;
  hasStrategies: boolean;
}

const steps = [
  {
    key: "accounts",
    title: "Connect an Exchange",
    description: "Link your Binance or NSE account to start trading.",
    href: "/accounts",
  },
  {
    key: "strategies",
    title: "Pick a Strategy",
    description: "Browse pre-built strategies in the Marketplace, or create a custom one.",
    href: "/marketplace",
  },
  {
    key: "backtest",
    title: "Run a Backtest",
    description: "Test your strategy against historical data.",
    href: "/backtest",
  },
  {
    key: "live",
    title: "Go Live",
    description: "Switch from MOCK to LIVE when you're ready.",
    href: null,
  },
] as const;

export function GettingStarted({ hasAccounts, hasStrategies }: Props) {
  const completed: Record<string, boolean> = {
    accounts: hasAccounts,
    strategies: hasStrategies,
    backtest: false,
    live: false,
  };

  return (
    <div className="rounded-lg border border-dashed border-border/60 bg-card/50 p-4 sm:p-6">
      <h2 className="text-sm font-medium text-foreground">
        Welcome to Mach-Zero
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Complete these steps to start algorithmic trading.
      </p>
      <div className="mt-4 space-y-1">
        {steps.map((step, i) => {
          const done = completed[step.key];
          const content = (
            <div className="flex items-start gap-3 group">
              {done ? (
                <CheckCircle2 className="size-5 text-green-500 mt-0.5 shrink-0" />
              ) : (
                <div className="flex size-5 items-center justify-center rounded-full border border-border text-[10px] font-medium text-muted-foreground mt-0.5 shrink-0">
                  {i + 1}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "text-sm font-medium",
                    done && "line-through text-muted-foreground"
                  )}
                >
                  {step.title}
                  {step.key === "live" && (
                    <Badge
                      variant="outline"
                      className="ml-2 text-[10px] align-middle"
                    >
                      MOCK
                    </Badge>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {step.description}
                </p>
              </div>
              {step.href && !done && (
                <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 shrink-0" />
              )}
            </div>
          );

          return step.href && !done ? (
            <Link
              key={step.key}
              href={step.href}
              className="block rounded-md px-2 py-2 -mx-2 hover:bg-muted/50 transition-colors"
            >
              {content}
            </Link>
          ) : (
            <div key={step.key} className="px-2 py-2 -mx-2">
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import type { SymbolState } from "@/types";
import { formatPrice } from "@/lib/utils";

interface Props {
  symbols: SymbolState[];
}

export function MarketDataPanel({ symbols }: Props) {
  if (symbols.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-muted-foreground">
        No market data available.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {symbols.map((sym) => (
        <div
          key={sym.symbolId}
          className="flex flex-col gap-1"
        >
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">{sym.name}</span>
            <span className="text-[10px] text-muted-foreground">{sym.venue}</span>
          </div>
          <div className="text-lg font-semibold tabular-nums font-mono">
            {formatPrice(sym.lastPrice)}
          </div>
          <div className="flex gap-3 text-[11px]">
            <div>
              <span className="text-muted-foreground">Bid </span>
              <span className="font-mono tabular-nums text-green-600 dark:text-green-400">
                {formatPrice(sym.bidPrice)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Ask </span>
              <span className="font-mono tabular-nums text-red-600 dark:text-red-400">
                {formatPrice(sym.askPrice)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Spread </span>
              <span className="font-mono tabular-nums">
                {formatPrice(sym.spread, 4)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

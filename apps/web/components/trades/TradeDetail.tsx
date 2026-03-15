"use client";

import type { Trade } from "@/types";
import {
  getSymbolName,
  getVenueName,
  getSideName,
  formatPrice,
  formatQuantity,
  formatTimestamp,
  cn,
} from "@/lib/utils";

interface Props {
  trade: Trade;
}

export function TradeDetail({ trade }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <DetailItem label="Symbol" value={getSymbolName(trade.symbol_id)} />
        <DetailItem label="Venue" value={getVenueName(trade.venue)} />
        <DetailItem
          label="Side"
          value={getSideName(trade.side)}
          className={
            trade.side === 1
              ? "text-green-600 dark:text-green-400"
              : trade.side === 2
                ? "text-red-600 dark:text-red-400"
                : "text-muted-foreground"
          }
        />
        <DetailItem label="Price" value={formatPrice(trade.price)} />
        <DetailItem label="Quantity" value={formatQuantity(trade.quantity)} />
        <DetailItem label="Time" value={formatTimestamp(trade.timestamp)} />
        <DetailItem
          label="Mode"
          value={trade.trading_mode === "MOCK" ? "Paper" : trade.trading_mode === "LIVE" ? "Live" : trade.trading_mode ?? "N/A"}
        />
      </div>
    </div>
  );
}

function DetailItem({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-sm font-medium mt-0.5", className)}>{value}</p>
    </div>
  );
}

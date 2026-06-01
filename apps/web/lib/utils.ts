import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── Trading utility functions ────────────────────────────────────────

const SYMBOLS: Record<number, string> = {
  1: "BTCUSDT",
  2: "ETHUSDT",
  3: "SOLUSDT",
  4: "BNBUSDT",
  5: "XRPUSDT",
  6: "DOGEUSDT",
  7: "ADAUSDT",
  8: "AVAXUSDT",
};

const VENUES: Record<number, string> = {
  1: "Binance",
  2: "NSE",
};

const SIDES: Record<number, string> = {
  1: "Buy",
  2: "Sell",
};

export function fromFixedPoint(value: number): number {
  return value / 100_000_000;
}

export function formatPrice(price: number, decimals = 2): string {
  return price.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatQuantity(qty: number, decimals = 4): string {
  return qty.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export function formatPnl(pnl: number): string {
  const sign = pnl > 0 ? "+" : "";
  return `${sign}${formatPrice(pnl)}`;
}

export function pnlColor(pnl: number): string {
  if (pnl > 0) return "text-positive";
  if (pnl < 0) return "text-negative";
  return "text-muted-foreground";
}

export function getSymbolName(symbolId: number): string {
  // symbolId 0 is the "no symbol" sentinel (e.g. some risk rejections) — show
  // a dash rather than a meaningless "SYM-0".
  if (!symbolId) return "—";
  return SYMBOLS[symbolId] ?? `SYM-${symbolId}`;
}

export function getVenueName(venueId: number): string {
  return VENUES[venueId] ?? `V${venueId}`;
}

export function getSideName(side: number): string {
  return SIDES[side] ?? `S${side}`;
}

// Render an engine code (snake_case / lowercase, e.g. "order_rate", "partial")
// as a human Title Case label ("Order Rate", "Partial"). Shared so the reports
// charts and the data-table cells format reject reasons / statuses identically.
export function formatSnakeLabel(raw: string | null | undefined): string {
  if (!raw) return "—";
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatTimestamp(ts: string | number): string {
  const d = new Date(typeof ts === "number" ? ts / 1000 : ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

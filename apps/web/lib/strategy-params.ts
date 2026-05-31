import { formatPrice, formatQuantity } from "@/lib/utils";

// Strategy params cross the SBE hot path in the engine's fixed-point convention
// (1.0 == 1e8). The dashboard edits/displays them in human units and converts
// at the boundary so users never see/enter raw integers like "100000000".
export const FIXED_POINT = 1e8;

// Param keys stored as 8-decimal fixed-point (prices/quantities). Everything
// else (e.g. windowSize, a plain count) is used as-is.
export const FIXED_POINT_PARAMS = new Set([
  "spreadOffset",
  "threshold",
  "orderQuantity",
]);

const PARAM_LABELS: Record<string, string> = {
  spreadOffset: "Spread",
  orderQuantity: "Order Qty",
  threshold: "Threshold",
  windowSize: "Window",
};

export function paramLabel(key: string): string {
  return PARAM_LABELS[key] ?? key;
}

/** Stored (fixed-point) value -> a plain numeric string for an editable input. */
export function paramToInput(key: string, stored: unknown): string {
  if (typeof stored !== "number") return stored == null ? "" : String(stored);
  return FIXED_POINT_PARAMS.has(key) ? String(stored / FIXED_POINT) : String(stored);
}

/** Human input string -> the stored value (fixed-point for price/qty params). */
export function paramToStored(key: string, input: string): number | string {
  const n = Number(input);
  if (input.trim() === "" || Number.isNaN(n)) return input;
  return FIXED_POINT_PARAMS.has(key) ? Math.round(n * FIXED_POINT) : n;
}

/** Stored value -> pretty, read-only display string (with locale formatting). */
export function formatParamDisplay(key: string, stored: unknown): string {
  if (typeof stored !== "number") return String(stored);
  if (key === "spreadOffset" || key === "threshold") return formatPrice(stored / FIXED_POINT);
  if (key === "orderQuantity") return formatQuantity(stored / FIXED_POINT);
  return stored.toLocaleString();
}

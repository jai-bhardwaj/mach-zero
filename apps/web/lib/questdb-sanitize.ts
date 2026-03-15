// QuestDB input sanitization — whitelist validators for query parameters
// QuestDB REST API does not support parameterized queries, so we validate
// all user inputs before interpolation into SQL strings.

const VALID_TRADING_MODES = new Set(["MOCK", "LIVE"]);

const VALID_ORDER_STATUSES = new Set([
  "new",
  "acked",
  "pending",
  "filled",
  "partial_fill",
  "partially_filled",
  "rejected",
  "cancelled",
]);

/** Returns the value if it's a valid trading mode, otherwise null. */
export function validateTradingMode(val: string): string | null {
  return VALID_TRADING_MODES.has(val) ? val : null;
}

/** Returns the value (uppercased) if it's a valid order status, otherwise null.
 *  Accepts both UPPERCASE and lowercase input (e.g. "filled" → "FILLED"). */
export function validateOrderStatus(val: string): string | null {
  const lower = val.toLowerCase();
  return VALID_ORDER_STATUSES.has(lower) ? lower.toUpperCase() : null;
}

/** Returns the value if it contains only safe characters (alphanumeric, underscore, hyphen). */
export function validateRiskReason(val: string): string | null {
  return /^[a-zA-Z0-9_-]+$/.test(val) ? val : null;
}

/** Returns the value if it's a valid ISO 8601 timestamp, otherwise null. */
export function validateTimestamp(val: string): string | null {
  // Accept ISO 8601 formats: 2024-01-15, 2024-01-15T10:30:00, 2024-01-15T10:30:00Z, etc.
  if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(val)) {
    return null;
  }
  // Verify it parses to a valid date
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return val;
}

/** Clamps a numeric days value to the range [1, 365]. */
export function validateDays(val: number): number {
  if (!Number.isFinite(val) || val < 1) return 1;
  if (val > 365) return 365;
  return Math.floor(val);
}

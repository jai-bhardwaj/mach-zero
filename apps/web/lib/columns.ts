import type { ColumnMeta } from "@/types";

// ── Trade Column Metadata ───────────────────────────────────────────
export const TRADE_COLUMN_META: Record<string, ColumnMeta> = {
  timestamp:    { accessorKey: "timestamp",    serverSortable: true,  serverFilterable: true,  filterType: "dateRange", questdbColumn: "timestamp" },
  symbol_id:    { accessorKey: "symbol_id",    serverSortable: true,  serverFilterable: true,  filterType: "select",    questdbColumn: "symbol_id" },
  venue:        { accessorKey: "venue",        serverSortable: true,  serverFilterable: true,  filterType: "select",    questdbColumn: "venue" },
  side:         { accessorKey: "side",         serverSortable: true,  serverFilterable: true,  filterType: "select",    questdbColumn: "side" },
  price:        { accessorKey: "price",        serverSortable: true,  serverFilterable: false, questdbColumn: "price" },
  quantity:     { accessorKey: "quantity",      serverSortable: true,  serverFilterable: false, questdbColumn: "quantity" },
  trading_mode: { accessorKey: "trading_mode", serverSortable: false, serverFilterable: true,  filterType: "select",    questdbColumn: "trading_mode" },
};

export const TRADES_SORTABLE_COLUMNS = Object.entries(TRADE_COLUMN_META)
  .filter(([, m]) => m.serverSortable)
  .map(([k]) => k);

// ── Order Column Metadata ───────────────────────────────────────────
export const ORDER_COLUMN_META: Record<string, ColumnMeta> = {
  timestamp:    { accessorKey: "timestamp",    serverSortable: true,  serverFilterable: true,  filterType: "dateRange", questdbColumn: "timestamp" },
  order_id:     { accessorKey: "order_id",     serverSortable: true,  serverFilterable: false, questdbColumn: "order_id" },
  symbol_id:    { accessorKey: "symbol_id",    serverSortable: true,  serverFilterable: true,  filterType: "select",    questdbColumn: "symbol_id" },
  side:         { accessorKey: "side",         serverSortable: true,  serverFilterable: true,  filterType: "select",    questdbColumn: "side" },
  price:        { accessorKey: "price",        serverSortable: true,  serverFilterable: false, questdbColumn: "price" },
  quantity:     { accessorKey: "quantity",      serverSortable: true,  serverFilterable: false, questdbColumn: "quantity" },
  status:       { accessorKey: "status",       serverSortable: true,  serverFilterable: true,  filterType: "select",    questdbColumn: "status" },
  trading_mode: { accessorKey: "trading_mode", serverSortable: false, serverFilterable: true,  filterType: "select",    questdbColumn: "trading_mode" },
};

export const ORDERS_SORTABLE_COLUMNS = Object.entries(ORDER_COLUMN_META)
  .filter(([, m]) => m.serverSortable)
  .map(([k]) => k);

// ── Risk Event Column Metadata ──────────────────────────────────────
export const RISK_EVENT_COLUMN_META: Record<string, ColumnMeta> = {
  timestamp:    { accessorKey: "timestamp",    serverSortable: true,  serverFilterable: true,  filterType: "dateRange", questdbColumn: "timestamp" },
  order_id:     { accessorKey: "order_id",     serverSortable: true,  serverFilterable: false, questdbColumn: "order_id" },
  symbol_id:    { accessorKey: "symbol_id",    serverSortable: true,  serverFilterable: true,  filterType: "select",    questdbColumn: "symbol_id" },
  reason:       { accessorKey: "reason",       serverSortable: true,  serverFilterable: true,  filterType: "select",    questdbColumn: "reason" },
  trading_mode: { accessorKey: "trading_mode", serverSortable: false, serverFilterable: true,  filterType: "select",    questdbColumn: "trading_mode" },
};

export const RISK_EVENTS_SORTABLE_COLUMNS = Object.entries(RISK_EVENT_COLUMN_META)
  .filter(([, m]) => m.serverSortable)
  .map(([k]) => k);

// ── Validation helpers ──────────────────────────────────────────────

/** Returns the value if it matches an allowed column name. Prevents SQL injection. */
export function validateSortColumn(column: string, allowedColumns: string[]): string | null {
  return allowedColumns.includes(column) ? column : null;
}

/** Returns the value if it's a valid sort direction. */
export function validateSortDirection(dir: string): "ASC" | "DESC" | null {
  const upper = dir.toUpperCase();
  return upper === "ASC" || upper === "DESC" ? upper : null;
}

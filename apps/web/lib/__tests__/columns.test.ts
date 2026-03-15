import { describe, it, expect } from "vitest";
import {
  TRADES_SORTABLE_COLUMNS,
  ORDERS_SORTABLE_COLUMNS,
  RISK_EVENTS_SORTABLE_COLUMNS,
  TRADE_COLUMN_META,
  ORDER_COLUMN_META,
  RISK_EVENT_COLUMN_META,
  validateSortColumn,
  validateSortDirection,
} from "../columns";

describe("Column metadata", () => {
  describe("TRADE_COLUMN_META", () => {
    it("has all expected columns", () => {
      expect(Object.keys(TRADE_COLUMN_META)).toContain("timestamp");
      expect(Object.keys(TRADE_COLUMN_META)).toContain("symbol_id");
      expect(Object.keys(TRADE_COLUMN_META)).toContain("price");
    });

    it("marks timestamp as sortable", () => {
      expect(TRADE_COLUMN_META.timestamp.serverSortable).toBe(true);
    });

    it("marks trading_mode as non-sortable", () => {
      expect(TRADE_COLUMN_META.trading_mode.serverSortable).toBe(false);
    });
  });

  describe("TRADES_SORTABLE_COLUMNS", () => {
    it("includes sortable columns", () => {
      expect(TRADES_SORTABLE_COLUMNS).toContain("timestamp");
      expect(TRADES_SORTABLE_COLUMNS).toContain("price");
      expect(TRADES_SORTABLE_COLUMNS).toContain("quantity");
    });

    it("excludes non-sortable columns", () => {
      expect(TRADES_SORTABLE_COLUMNS).not.toContain("trading_mode");
    });
  });

  describe("ORDER_COLUMN_META", () => {
    it("includes status column", () => {
      expect(Object.keys(ORDER_COLUMN_META)).toContain("status");
    });
  });

  describe("ORDERS_SORTABLE_COLUMNS", () => {
    it("includes sortable columns", () => {
      expect(ORDERS_SORTABLE_COLUMNS).toContain("timestamp");
      expect(ORDERS_SORTABLE_COLUMNS).toContain("status");
    });

    it("excludes non-sortable columns", () => {
      expect(ORDERS_SORTABLE_COLUMNS).not.toContain("trading_mode");
    });
  });

  describe("RISK_EVENT_COLUMN_META", () => {
    it("includes reason column", () => {
      expect(Object.keys(RISK_EVENT_COLUMN_META)).toContain("reason");
    });
  });

  describe("RISK_EVENTS_SORTABLE_COLUMNS", () => {
    it("includes sortable columns", () => {
      expect(RISK_EVENTS_SORTABLE_COLUMNS).toContain("timestamp");
      expect(RISK_EVENTS_SORTABLE_COLUMNS).toContain("reason");
    });

    it("excludes non-sortable columns", () => {
      expect(RISK_EVENTS_SORTABLE_COLUMNS).not.toContain("trading_mode");
    });
  });
});

describe("validateSortColumn", () => {
  it("returns column when valid", () => {
    expect(validateSortColumn("timestamp", TRADES_SORTABLE_COLUMNS)).toBe(
      "timestamp"
    );
  });

  it("returns null for invalid column", () => {
    expect(
      validateSortColumn("nonexistent", TRADES_SORTABLE_COLUMNS)
    ).toBeNull();
  });

  it("rejects SQL injection attempts", () => {
    expect(
      validateSortColumn(
        "timestamp; DROP TABLE trades",
        TRADES_SORTABLE_COLUMNS
      )
    ).toBeNull();
    expect(
      validateSortColumn("timestamp--", TRADES_SORTABLE_COLUMNS)
    ).toBeNull();
    expect(
      validateSortColumn("1 OR 1=1", TRADES_SORTABLE_COLUMNS)
    ).toBeNull();
  });

  it("is case-sensitive", () => {
    expect(
      validateSortColumn("TIMESTAMP", TRADES_SORTABLE_COLUMNS)
    ).toBeNull();
  });
});

describe("validateSortDirection", () => {
  it("returns ASC for 'asc'", () => {
    expect(validateSortDirection("asc")).toBe("ASC");
  });

  it("returns DESC for 'desc'", () => {
    expect(validateSortDirection("desc")).toBe("DESC");
  });

  it("returns ASC for 'ASC'", () => {
    expect(validateSortDirection("ASC")).toBe("ASC");
  });

  it("returns DESC for 'DESC'", () => {
    expect(validateSortDirection("DESC")).toBe("DESC");
  });

  it("returns null for invalid direction", () => {
    expect(validateSortDirection("sideways")).toBeNull();
    expect(validateSortDirection("")).toBeNull();
    expect(validateSortDirection("UP")).toBeNull();
  });
});

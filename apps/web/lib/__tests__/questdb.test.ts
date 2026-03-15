import { describe, it, expect, vi } from "vitest";

// Mock server-only to prevent it from throwing in test environment
vi.mock("server-only", () => ({}));

import { buildOrderBy } from "../questdb";

describe("buildOrderBy", () => {
  const allowedColumns = ["timestamp", "price", "quantity", "symbol_id"];

  it("returns default when no sort column provided", () => {
    expect(buildOrderBy(null, null, allowedColumns)).toBe("timestamp DESC");
  });

  it("returns default when sort column is empty", () => {
    expect(buildOrderBy("", null, allowedColumns)).toBe("timestamp DESC");
  });

  it("returns default when sort column is not allowed", () => {
    expect(buildOrderBy("malicious_column", "ASC", allowedColumns)).toBe(
      "timestamp DESC"
    );
  });

  it("builds valid orderBy with ASC direction", () => {
    expect(buildOrderBy("price", "ASC", allowedColumns)).toBe("price ASC");
  });

  it("builds valid orderBy with DESC direction", () => {
    expect(buildOrderBy("quantity", "DESC", allowedColumns)).toBe(
      "quantity DESC"
    );
  });

  it("defaults to DESC when direction is invalid", () => {
    expect(buildOrderBy("price", "invalid", allowedColumns)).toBe(
      "price DESC"
    );
  });

  it("defaults to DESC when direction is null", () => {
    expect(buildOrderBy("price", null, allowedColumns)).toBe("price DESC");
  });

  it("accepts custom default orderBy", () => {
    expect(buildOrderBy(null, null, allowedColumns, "price ASC")).toBe(
      "price ASC"
    );
  });

  it("is case-insensitive for direction", () => {
    expect(buildOrderBy("price", "asc", allowedColumns)).toBe("price ASC");
    expect(buildOrderBy("price", "Desc", allowedColumns)).toBe("price DESC");
  });

  it("rejects SQL injection in column name", () => {
    expect(
      buildOrderBy("price; DROP TABLE trades", "ASC", allowedColumns)
    ).toBe("timestamp DESC");
  });

  it("works with symbol_id column", () => {
    expect(buildOrderBy("symbol_id", "ASC", allowedColumns)).toBe(
      "symbol_id ASC"
    );
  });
});

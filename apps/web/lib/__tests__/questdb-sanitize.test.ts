// Regression tests for the QuestDB query sanitizers.
//
// QuestDB's REST API does not support parameterized queries — every value
// is interpolated into a SQL string. Each input from a user must therefore
// be validated through one of these whitelist functions before it reaches
// `${...}` in a SQL template literal. If any of these tests start failing,
// a code change has weakened the SQL-injection guarantees of the read
// path. Treat as a P0.

import { describe, it, expect } from "vitest";
import {
  validateTradingMode,
  validateOrderStatus,
  validateRiskReason,
  validateTimestamp,
  validateDays,
} from "../questdb-sanitize";
import { buildOrderBy } from "../questdb";

describe("validateTradingMode", () => {
  it.each(["MOCK", "LIVE"])("accepts %s", (v) => {
    expect(validateTradingMode(v)).toBe(v);
  });

  it.each([
    "mock",                              // case-sensitive: lowercase is not in the whitelist
    "live",
    "DEV",
    "",
    "MOCK; DROP TABLE trades --",
    "MOCK' OR '1'='1",
    "MOCK\nLIVE",
    "MOCK,LIVE",
  ])("rejects %j", (v) => {
    expect(validateTradingMode(v)).toBeNull();
  });
});

describe("validateOrderStatus", () => {
  it("accepts whitelist values (case-insensitive)", () => {
    expect(validateOrderStatus("filled")).toBe("FILLED");
    expect(validateOrderStatus("FILLED")).toBe("FILLED");
    expect(validateOrderStatus("Acked")).toBe("ACKED");
  });

  it.each([
    "filled' OR '1'='1",
    "filled; DELETE FROM orders",
    "filled--",
    "filled OR 1=1",
    "filled\u0000",                      // null byte
    "",
    " filled",                           // leading whitespace
    "filled ",
  ])("rejects %j", (v) => {
    expect(validateOrderStatus(v)).toBeNull();
  });
});

describe("validateRiskReason", () => {
  it.each(["PriceBand", "kill_switch", "risk-event", "abc123"])(
    "accepts safe identifier %s",
    (v) => {
      expect(validateRiskReason(v)).toBe(v);
    }
  );

  it.each([
    "PriceBand' OR '1'='1",
    "PriceBand; DROP TABLE",
    "Price Band",                        // space
    "Price'Band",                        // single quote
    "Price\"Band",                       // double quote
    "Price/Band",                        // slash
    "Price.Band",                        // dot
    "Price\nBand",                       // newline
    "",
  ])("rejects %j", (v) => {
    expect(validateRiskReason(v)).toBeNull();
  });
});

describe("validateTimestamp", () => {
  it.each([
    "2024-01-15",
    "2024-01-15T10:30:00",
    "2024-01-15T10:30:00Z",
    "2024-01-15T10:30:00.123Z",
    "2024-01-15T10:30:00+05:30",
  ])("accepts ISO 8601 %s", (v) => {
    expect(validateTimestamp(v)).toBe(v);
  });

  it.each([
    "2024-01-15'; DROP TABLE trades --",
    "now()",
    "2024-13-99",                        // invalid month/day
    "2024-01-15 10:30",                  // space instead of T
    "2024",                              // too short
    "yesterday",
    "",
    "2024-01-15T10:30:00Z' OR '1'='1",
    "2024-01-15--",
  ])("rejects %j", (v) => {
    expect(validateTimestamp(v)).toBeNull();
  });
});

describe("validateDays", () => {
  it("clamps low values to 1", () => {
    expect(validateDays(-100)).toBe(1);
    expect(validateDays(0)).toBe(1);
    expect(validateDays(0.5)).toBe(1);
  });

  it("clamps high values to 365", () => {
    expect(validateDays(366)).toBe(365);
    expect(validateDays(99999)).toBe(365);
  });

  it("rejects non-finite", () => {
    expect(validateDays(NaN)).toBe(1);
    expect(validateDays(Infinity)).toBe(1);
    expect(validateDays(-Infinity)).toBe(1);
  });

  it("returns floored integer in range", () => {
    expect(validateDays(7)).toBe(7);
    expect(validateDays(7.9)).toBe(7);
    expect(validateDays(365)).toBe(365);
  });
});

describe("buildOrderBy", () => {
  const allowed = ["timestamp", "price", "quantity"];

  it("returns default for null/empty/unknown columns", () => {
    expect(buildOrderBy(null, null, allowed)).toBe("timestamp DESC");
    expect(buildOrderBy("", null, allowed)).toBe("timestamp DESC");
    expect(buildOrderBy("not_in_list", "ASC", allowed)).toBe("timestamp DESC");
  });

  it("returns default when injection attempt is in column", () => {
    // The whole point: a malicious sort param can't reach the SQL
    expect(buildOrderBy("price; DROP TABLE trades --", "ASC", allowed)).toBe(
      "timestamp DESC"
    );
    expect(buildOrderBy("1=1; --", "ASC", allowed)).toBe("timestamp DESC");
  });

  it("normalizes direction to ASC or DESC", () => {
    expect(buildOrderBy("price", "ASC", allowed)).toBe("price ASC");
    expect(buildOrderBy("price", "asc", allowed)).toBe("price ASC");
    expect(buildOrderBy("price", "DESC", allowed)).toBe("price DESC");
    // Unknown direction defaults to DESC
    expect(buildOrderBy("price", "RANDOM", allowed)).toBe("price DESC");
    expect(buildOrderBy("price", "ASC; DROP TABLE", allowed)).toBe("price DESC");
    expect(buildOrderBy("price", null, allowed)).toBe("price DESC");
  });

  it("uses caller-provided default when no sort given", () => {
    expect(buildOrderBy(null, null, allowed, "price ASC")).toBe("price ASC");
  });
});

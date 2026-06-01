import { describe, it, expect } from "vitest";
import {
  cn,
  fromFixedPoint,
  formatPrice,
  formatQuantity,
  formatPnl,
  pnlColor,
  getSymbolName,
  getVenueName,
  getSideName,
  formatTimestamp,
  formatSnakeLabel,
} from "../utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "extra")).toBe("base extra");
    expect(cn("base", true && "visible")).toBe("base visible");
  });

  it("deduplicates conflicting tailwind classes", () => {
    expect(cn("p-4", "p-2")).toBe("p-2");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("handles undefined and null", () => {
    expect(cn("base", undefined, null)).toBe("base");
  });
});

describe("fromFixedPoint", () => {
  it("converts 100_000_000 to 1.0", () => {
    expect(fromFixedPoint(100_000_000)).toBe(1.0);
  });

  it("converts 0 to 0", () => {
    expect(fromFixedPoint(0)).toBe(0);
  });

  it("converts large BTC-scale price", () => {
    expect(fromFixedPoint(6_850_000_000_000)).toBe(68500);
  });

  it("handles negative values", () => {
    expect(fromFixedPoint(-500_000_000)).toBe(-5);
  });
});

describe("formatPrice", () => {
  it("formats with 2 decimal places by default", () => {
    const result = formatPrice(1234.5);
    expect(result).toContain("1");
    expect(result).toContain("234");
    expect(result).toContain("50");
  });

  it("handles zero", () => {
    const result = formatPrice(0);
    expect(result).toContain("0");
    expect(result).toContain("00");
  });

  it("handles negative numbers", () => {
    const result = formatPrice(-100);
    expect(result).toContain("100");
    expect(result).toContain("00");
  });

  it("respects custom decimals", () => {
    const result = formatPrice(1.23456, 4);
    expect(result).toContain("2346"); // rounded to 4 decimals
  });
});

describe("formatQuantity", () => {
  it("formats integers without trailing decimals", () => {
    const result = formatQuantity(100);
    expect(result).toContain("100");
    // Should not have trailing .0000
    expect(result).not.toContain("0000");
  });

  it("preserves meaningful decimals up to 4", () => {
    const result = formatQuantity(1.5);
    expect(result).toContain("1");
    expect(result).toContain("5");
  });

  it("respects custom decimal parameter", () => {
    const result = formatQuantity(1.123456, 2);
    // Should round to 2 decimals
    expect(result).toContain("12");
  });
});

describe("formatPnl", () => {
  it("prepends + for positive values", () => {
    const result = formatPnl(100);
    expect(result).toMatch(/^\+/);
  });

  it("includes - for negative values", () => {
    const result = formatPnl(-50);
    expect(result).toContain("-");
  });

  it("formats zero without sign prefix", () => {
    const result = formatPnl(0);
    expect(result).toContain("0");
    expect(result).not.toMatch(/^\+/);
    expect(result).not.toMatch(/^-/);
  });
});

describe("pnlColor", () => {
  it("returns text-positive for positive pnl", () => {
    expect(pnlColor(100)).toBe("text-positive");
  });

  it("returns text-negative for negative pnl", () => {
    expect(pnlColor(-50)).toBe("text-negative");
  });

  it("returns text-muted-foreground for zero", () => {
    expect(pnlColor(0)).toBe("text-muted-foreground");
  });
});

describe("getSymbolName", () => {
  it("returns BTCUSDT for symbolId 1", () => {
    expect(getSymbolName(1)).toBe("BTCUSDT");
  });

  it("returns ETHUSDT for symbolId 2", () => {
    expect(getSymbolName(2)).toBe("ETHUSDT");
  });

  it("returns fallback for unknown symbolId", () => {
    expect(getSymbolName(99)).toBe("SYM-99");
  });
});

describe("getVenueName", () => {
  it("returns Binance for venueId 1", () => {
    expect(getVenueName(1)).toBe("Binance");
  });

  it("returns NSE for venueId 2", () => {
    expect(getVenueName(2)).toBe("NSE");
  });

  it("returns fallback for unknown venueId", () => {
    expect(getVenueName(99)).toBe("V99");
  });
});

describe("getSideName", () => {
  it("returns Buy for side 1", () => {
    expect(getSideName(1)).toBe("Buy");
  });

  it("returns Sell for side 2", () => {
    expect(getSideName(2)).toBe("Sell");
  });

  it("returns fallback for unknown side", () => {
    expect(getSideName(99)).toBe("S99");
  });
});

describe("formatTimestamp", () => {
  it("formats an ISO string timestamp", () => {
    const result = formatTimestamp("2026-03-14T10:05:30.000Z");
    expect(result).toMatch(/2026-03-14/);
    expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it("formats a numeric microsecond timestamp", () => {
    // 1710403200000000 microseconds = 1710403200000 ms = 2024-03-14T08:00:00Z
    const result = formatTimestamp(1710403200000000);
    expect(result).toMatch(/2024/);
    expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it("pads single-digit months and days", () => {
    const result = formatTimestamp("2026-01-05T03:02:01.000Z");
    expect(result).toMatch(/01-05/);
  });
});

describe("formatSnakeLabel", () => {
  it("converts snake_case engine codes to Title Case", () => {
    expect(formatSnakeLabel("order_rate")).toBe("Order Rate");
    expect(formatSnakeLabel("price_band")).toBe("Price Band");
    expect(formatSnakeLabel("position_limit")).toBe("Position Limit");
  });
  it("title-cases single lowercase words (order statuses)", () => {
    expect(formatSnakeLabel("partial")).toBe("Partial");
    expect(formatSnakeLabel("filled")).toBe("Filled");
    expect(formatSnakeLabel("validated")).toBe("Validated");
  });
  it("returns an em dash for null/empty", () => {
    expect(formatSnakeLabel(null)).toBe("—");
    expect(formatSnakeLabel(undefined)).toBe("—");
    expect(formatSnakeLabel("")).toBe("—");
  });
});

import { describe, it, expect } from "vitest";
import { realizedPnlSeries, type PnlFill } from "@/lib/pnl";

const buy = (price: number, quantity: number, symbol_id = 1): PnlFill => ({ symbol_id, side: 1, price, quantity });
const sell = (price: number, quantity: number, symbol_id = 1): PnlFill => ({ symbol_id, side: 2, price, quantity });
const last = (a: number[]) => a[a.length - 1];

describe("realizedPnlSeries (average-cost)", () => {
  it("simple round-trip: buy then sell higher", () => {
    expect(last(realizedPnlSeries([buy(100, 1), sell(110, 1)]))).toBe(10);
  });

  it("short round-trip: sell then buy lower is a profit", () => {
    expect(last(realizedPnlSeries([sell(100, 1), buy(90, 1)]))).toBe(10);
  });

  it("averages cost when adding to a position", () => {
    // buy 1@100, buy 1@120 -> avg 110; sell 2@130 -> (130-110)*2 = 40
    expect(last(realizedPnlSeries([buy(100, 1), buy(120, 1), sell(130, 2)]))).toBe(40);
  });

  it("open one-sided position has ZERO realized (the bug being fixed)", () => {
    // 500 sells, no buys -> no closed quantity -> realized 0 (not +millions)
    const fills = Array.from({ length: 500 }, () => sell(73000, 0.1));
    expect(last(realizedPnlSeries(fills))).toBe(0);
  });

  it("partial close realizes only the closed quantity", () => {
    // long 2@100, sell 1@110 -> realize (110-100)*1 = 10, still long 1
    expect(last(realizedPnlSeries([buy(100, 2), sell(110, 1)]))).toBe(10);
  });

  it("flip through zero: close then open new position at new price", () => {
    // long 1@100, sell 2@110 -> close 1 (+10), flip to short 1@110.
    // then buy 1@105 closes the short: (110-105)*1 = +5 -> total 15
    const s = realizedPnlSeries([buy(100, 1), sell(110, 2), buy(105, 1)]);
    expect(s[1]).toBe(10); // after the flipping sell, realized 10
    expect(last(s)).toBe(15);
  });

  it("tracks symbols independently", () => {
    const s = realizedPnlSeries([buy(100, 1, 1), buy(200, 1, 2), sell(110, 1, 1), sell(190, 1, 2)]);
    expect(last(s)).toBe(0); // +10 on sym1, -10 on sym2
  });

  it("a loss is negative", () => {
    expect(last(realizedPnlSeries([buy(100, 1), sell(90, 1)]))).toBe(-10);
  });
});

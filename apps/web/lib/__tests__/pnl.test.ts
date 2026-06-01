import { describe, it, expect } from "vitest";
import { realizedPnlSeries, realizedPnlDaily, type PnlFill, type DatedFill } from "@/lib/pnl";

const buy = (price: number, quantity: number, symbol_id = 1): PnlFill => ({ symbol_id, side: 1, price, quantity });
const sell = (price: number, quantity: number, symbol_id = 1): PnlFill => ({ symbol_id, side: 2, price, quantity });
const last = (a: number[]) => a[a.length - 1];

const at = (ts: string, f: PnlFill): DatedFill => ({ ...f, timestamp: ts });

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

describe("realizedPnlDaily (UTC-day buckets)", () => {
  it("empty input -> no days, zero total", () => {
    expect(realizedPnlDaily([])).toEqual({ daily: [], total: 0 });
  });

  it("attributes realized gain to the day the position is CLOSED", () => {
    // open on day 1, close on day 2 -> the whole +10 lands on day 2
    const r = realizedPnlDaily([
      at("2026-05-01T10:00:00Z", buy(100, 1)),
      at("2026-05-02T10:00:00Z", sell(110, 1)),
    ]);
    expect(r.total).toBe(10);
    expect(r.daily).toEqual([{ date: "2026-05-02", pnl: 10 }]);
  });

  it("days with no realized P&L are omitted (no zero-pnl rows)", () => {
    // buy/sell same price on the same day -> 0 realized -> no day emitted
    const r = realizedPnlDaily([
      at("2026-05-01T10:00:00Z", buy(73615.2, 0.00016)),
      at("2026-05-01T10:00:01Z", sell(73615.2, 0.00016)),
    ]);
    expect(r.total).toBe(0);
    expect(r.daily).toEqual([]);
  });

  it("symmetric demo tape nets ~0, not a giant cashflow number", () => {
    // 1000 alternating buy/sell at one price -> realized ~0 (the bug fixed)
    const fills: DatedFill[] = [];
    for (let i = 0; i < 1000; i++) {
      fills.push(at(`2026-05-0${(i % 5) + 1}T10:00:0${i % 10}Z`, i % 2 === 0 ? buy(73615.2, 0.001) : sell(73615.2, 0.001)));
    }
    const r = realizedPnlDaily(fills);
    expect(Math.abs(r.total)).toBeLessThan(0.01);
  });

  it("buckets multiple closing days and the total ties out", () => {
    const r = realizedPnlDaily([
      at("2026-05-01T00:00:00Z", buy(100, 2)),
      at("2026-05-02T00:00:00Z", sell(110, 1)), // +10 on day 2
      at("2026-05-03T00:00:00Z", sell(120, 1)), // +20 on day 3
    ]);
    expect(r.daily).toEqual([
      { date: "2026-05-02", pnl: 10 },
      { date: "2026-05-03", pnl: 20 },
    ]);
    expect(r.total).toBe(30);
    expect(r.daily.reduce((s, d) => s + d.pnl, 0)).toBe(r.total);
  });
});

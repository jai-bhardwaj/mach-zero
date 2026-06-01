// Realized P&L from a stream of fills, using average-cost accounting per
// symbol. This is correct for *realized* P&L (closed quantity) and needs no
// live price — unlike the previous naive cashflow sum (buy=-value, sell=+value)
// which mislabels an open one-sided position (e.g. all sells) as profit.
//
// Side encoding matches the engine/SBE: 1 = Buy, 2 = Sell.

export interface PnlFill {
  symbol_id: number;
  side: number; // 1 buy, 2 sell
  price: number;
  quantity: number;
}

interface Pos {
  qty: number; // signed: +long, -short
  avgCost: number;
}

const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0);

/**
 * Fold a chronologically-ordered list of fills into the running realized P&L
 * after each fill. Returns one cumulative value per input fill.
 */
export function realizedPnlSeries(fills: PnlFill[]): number[] {
  const positions = new Map<number, Pos>();
  let realized = 0;
  const out: number[] = [];

  for (const f of fills) {
    const signedQty = f.side === 1 ? f.quantity : -f.quantity;
    const pos = positions.get(f.symbol_id) ?? { qty: 0, avgCost: 0 };

    if (pos.qty === 0 || sign(pos.qty) === sign(signedQty)) {
      // Opening or adding to the position — roll the average cost.
      const newQty = pos.qty + signedQty;
      pos.avgCost =
        (pos.avgCost * Math.abs(pos.qty) + f.price * Math.abs(signedQty)) /
        Math.abs(newQty);
      pos.qty = newQty;
    } else {
      // Reducing / closing / flipping — realize on the closed quantity.
      const closeQty = Math.min(Math.abs(pos.qty), Math.abs(signedQty));
      // Long closed by a sell profits when price > avgCost; short closed by a
      // buy profits when price < avgCost. sign(pos.qty) captures both.
      realized += (f.price - pos.avgCost) * closeQty * sign(pos.qty);
      const newQty = pos.qty + signedQty;
      if (sign(newQty) !== 0 && sign(newQty) !== sign(pos.qty)) {
        // Flipped through zero — the remainder opens a new position at price.
        pos.avgCost = f.price;
      }
      pos.qty = newQty;
    }

    positions.set(f.symbol_id, pos);
    out.push(Math.round(realized * 100) / 100);
  }

  return out;
}

export interface DatedFill extends PnlFill {
  // QuestDB timestamp (ISO string or epoch-ms number).
  timestamp: string | number;
}

export interface DailyPnl {
  date: string; // UTC calendar day, YYYY-MM-DD
  pnl: number; // realized P&L *generated that day*
}

/**
 * Realized P&L bucketed by UTC calendar day. Folds the chronologically-ordered
 * fills once (average-cost, per symbol), then attributes each fill's *increment*
 * of cumulative realized P&L to the day of that fill. `total` is the cumulative
 * realized P&L over the whole input — i.e. the last cumulative value.
 *
 * This is the correct daily P&L: closing a position on day N realizes the gain
 * on day N, regardless of when the position was opened. The previous naive
 * `SUM(buy=-value, sell=+value)` per day reported raw cashflow, which labels an
 * open one-sided position as profit/loss it has not actually realized.
 *
 * Fills MUST be passed in chronological (ascending-timestamp) order.
 */
export function realizedPnlDaily(fills: DatedFill[]): {
  daily: DailyPnl[];
  total: number;
} {
  const cumulative = realizedPnlSeries(fills);
  const byDay = new Map<string, number>();
  let prev = 0;

  for (let i = 0; i < fills.length; i++) {
    const cur = cumulative[i];
    const delta = cur - prev;
    prev = cur;
    if (delta === 0) continue;
    const day = new Date(fills[i].timestamp).toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + delta);
  }

  const daily: DailyPnl[] = [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, pnl]) => ({ date, pnl: Math.round(pnl * 100) / 100 }));

  return { daily, total: cumulative.length ? cumulative[cumulative.length - 1] : 0 };
}

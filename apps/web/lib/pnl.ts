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

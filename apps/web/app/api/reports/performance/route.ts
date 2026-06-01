import { NextRequest, NextResponse } from "next/server";
import { queryQuestDB, rowsToObjects } from "@/lib/questdb";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { validateDays } from "@/lib/questdb-sanitize";
import { realizedPnlDaily, type DatedFill } from "@/lib/pnl";

// Cap on the number of fills folded into the realized-P&L computation. Realized
// P&L is path-dependent (average-cost per symbol), so it must be computed over
// the chronological fill sequence in JS — it can't be expressed as a SQL
// SAMPLE BY. We pull the period's fills oldest-first so positions open
// correctly from the start of the window; if the window has more fills than the
// cap, the tail is excluded and we surface `capped: true` rather than silently
// truncating. Real tenants are far under this; only the synthetic demo tape
// generates millions of fills.
const FILL_CAP = 100_000;

export async function GET(request: NextRequest) {
  const session = await requireAuth();
  if (isAuthError(session)) return session;

  const params = request.nextUrl.searchParams;
  const period = params.get("period") ?? "7d";

  const daysMap: Record<string, number> = { "1d": 1, "7d": 7, "30d": 30 };
  const days = validateDays(daysMap[period] ?? 7);
  // Post-v3 QuestDB schema stores engineId in tenant_id column. Fail
  // closed on missing engineId.
  if (typeof session.engineId !== "number") {
    return NextResponse.json({ dailyPnl: [], summary: null, sideBreakdown: [] });
  }
  const tenantFilter = `AND tenant_id = '${session.engineId}'`;
  const since = `timestamp > dateadd('d', -${days}, now())`;

  try {
    const [fillsResult, summaryResult, sideResult] = await Promise.all([
      // Oldest-first so the average-cost fold opens positions in the right
      // order. trades rows for a tenant (tenant_id != 0) are that tenant's
      // executed fills.
      queryQuestDB(`
        SELECT timestamp, symbol_id, side, price, quantity
        FROM trades
        WHERE ${since} ${tenantFilter}
        ORDER BY timestamp ASC
        LIMIT ${FILL_CAP}
      `),
      // Notional-based aggregates (trade value, not P&L) — these are
      // legitimately price * quantity and stay in SQL.
      queryQuestDB(`
        SELECT
          COUNT(*) as total_trades,
          AVG(price * quantity) as avg_trade_value,
          MAX(price * quantity) as max_trade_value,
          MIN(price * quantity) as min_trade_value
        FROM trades
        WHERE ${since} ${tenantFilter}
      `),
      queryQuestDB(`
        SELECT side, COUNT(*) as count,
               SUM(price * quantity) as total_value,
               AVG(price * quantity) as avg_value
        FROM trades
        WHERE ${since} ${tenantFilter}
        GROUP BY side
      `),
    ]);

    const fills = rowsToObjects(fillsResult) as Array<{
      timestamp: string;
      symbol_id: number;
      side: number;
      price: number;
      quantity: number;
    }>;
    const capped = fills.length >= FILL_CAP;

    // Realized P&L (average-cost) per UTC day — replaces the previous naive
    // SUM(buy=-value, sell=+value) cashflow, which mislabeled an open one-sided
    // position as profit and produced misleadingly huge magnitudes.
    const { daily, total } = realizedPnlDaily(fills as DatedFill[]);

    const summary = (rowsToObjects(summaryResult)[0] ?? {}) as Record<string, number>;

    return NextResponse.json({
      // Shape kept stable for the client: { timestamp, daily_pnl, trade_count }.
      dailyPnl: daily.map((d) => ({
        timestamp: d.date,
        daily_pnl: d.pnl,
        trade_count: 0,
      })),
      summary: { ...summary, total_pnl: total },
      sideBreakdown: rowsToObjects(sideResult),
      capped,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to query performance data" },
      { status: 500 }
    );
  }
}

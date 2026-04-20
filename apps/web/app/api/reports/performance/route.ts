import { NextRequest, NextResponse } from "next/server";
import { queryQuestDB, rowsToObjects } from "@/lib/questdb";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { validateDays } from "@/lib/questdb-sanitize";

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
    return NextResponse.json({ dailyPnl: [], summary: {}, side: [] });
  }
  const tenantFilter = `AND tenant_id = '${session.engineId}'`;

  try {
    const [dailyPnlResult, summaryResult, sideResult] = await Promise.all([
      queryQuestDB(`
        SELECT timestamp,
               SUM(CASE WHEN side = 1 THEN price * quantity ELSE -price * quantity END) as daily_pnl,
               COUNT(*) as trade_count
        FROM trades
        WHERE timestamp > dateadd('d', -${days}, now()) ${tenantFilter}
        SAMPLE BY 1d ALIGN TO CALENDAR
        ORDER BY timestamp
      `),
      queryQuestDB(`
        SELECT
          SUM(CASE WHEN side = 1 THEN price * quantity ELSE -price * quantity END) as total_pnl,
          COUNT(*) as total_trades,
          AVG(price * quantity) as avg_trade_value,
          MAX(price * quantity) as max_trade_value,
          MIN(price * quantity) as min_trade_value
        FROM trades
        WHERE timestamp > dateadd('d', -${days}, now()) ${tenantFilter}
      `),
      queryQuestDB(`
        SELECT side, COUNT(*) as count,
               SUM(price * quantity) as total_value,
               AVG(price * quantity) as avg_value
        FROM trades
        WHERE timestamp > dateadd('d', -${days}, now()) ${tenantFilter}
        GROUP BY side
      `),
    ]);

    return NextResponse.json({
      dailyPnl: rowsToObjects(dailyPnlResult),
      summary: rowsToObjects(summaryResult)[0] ?? null,
      sideBreakdown: rowsToObjects(sideResult),
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to query performance data" },
      { status: 500 }
    );
  }
}

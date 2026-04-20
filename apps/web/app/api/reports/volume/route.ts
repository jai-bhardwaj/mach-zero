import { NextRequest, NextResponse } from "next/server";
import { queryQuestDB, rowsToObjects } from "@/lib/questdb";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { validateDays } from "@/lib/questdb-sanitize";

export async function GET(request: NextRequest) {
  const session = await requireAuth();
  if (isAuthError(session)) return session;

  const params = request.nextUrl.searchParams;
  const days = validateDays(Number(params.get("days") ?? "7"));
  if (typeof session.engineId !== "number") {
    return NextResponse.json({ bySymbol: [], hourly: [], side: [] });
  }
  const tenantFilter = `AND tenant_id = '${session.engineId}'`;

  try {
    const [bySymbolResult, hourlyResult, sideResult] = await Promise.all([
      queryQuestDB(`
        SELECT symbol_id, COUNT(*) as trade_count,
               SUM(price * quantity) as total_volume
        FROM trades
        WHERE timestamp > dateadd('d', -${days}, now()) ${tenantFilter}
        GROUP BY symbol_id
        ORDER BY total_volume DESC
      `),
      queryQuestDB(`
        SELECT timestamp, COUNT(*) as trade_count,
               SUM(price * quantity) as volume
        FROM trades
        WHERE timestamp > dateadd('d', -${days}, now()) ${tenantFilter}
        SAMPLE BY 1h ALIGN TO CALENDAR
        ORDER BY timestamp
      `),
      queryQuestDB(`
        SELECT side, COUNT(*) as count,
               SUM(quantity) as total_qty,
               SUM(price * quantity) as total_volume
        FROM trades
        WHERE timestamp > dateadd('d', -${days}, now()) ${tenantFilter}
        GROUP BY side
      `),
    ]);

    return NextResponse.json({
      bySymbol: rowsToObjects(bySymbolResult),
      hourly: rowsToObjects(hourlyResult),
      buySellRatio: rowsToObjects(sideResult),
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to query volume data" },
      { status: 500 }
    );
  }
}

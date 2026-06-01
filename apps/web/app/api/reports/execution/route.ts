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
    return NextResponse.json({ status: [], rejects: [], orderStats: {} });
  }
  const tenantFilter = `AND tenant_id = '${session.engineId}'`;

  try {
    const [statusResult, rejectResult, orderStatsResult] = await Promise.all([
      queryQuestDB(`
        SELECT status, COUNT(*) as count
        FROM orders
        WHERE timestamp > dateadd('d', -${days}, now()) ${tenantFilter}
        GROUP BY status
        ORDER BY count DESC
      `),
      queryQuestDB(`
        SELECT reason, COUNT(*) as count
        FROM risk_events
        WHERE timestamp > dateadd('d', -${days}, now()) ${tenantFilter}
        GROUP BY reason
        ORDER BY count DESC
      `),
      queryQuestDB(`
        SELECT COUNT(*) as total_orders
        FROM orders
        WHERE timestamp > dateadd('d', -${days}, now()) ${tenantFilter}
      `),
    ]);

    const statusBreakdown = rowsToObjects<{ status: string; count: number }>(statusResult);
    const orderStats = rowsToObjects<{ total_orders: number }>(orderStatsResult)[0];

    // Compute fill rate from status breakdown. Statuses are the LOWERCASE
    // strings persistence writes to QuestDB (filled/partial/new/validated) —
    // the previous UPPERCASE "FILLED"/"PARTIALLY_FILLED"/"ACKED" matched nothing,
    // so the fill rate always reported 0% even while orders were filling.
    const filledCount = statusBreakdown.find((s) => s.status === "filled")?.count ?? 0;
    const partialFilledCount = statusBreakdown.find((s) => s.status === "partial")?.count ?? 0;
    const totalOrders = orderStats?.total_orders ?? 0;

    return NextResponse.json({
      statusBreakdown,
      rejectReasons: rowsToObjects(rejectResult),
      orderStats: {
        totalOrders,
        filledOrders: filledCount + partialFilledCount,
        fillRate: totalOrders > 0 ? Math.round(((filledCount + partialFilledCount) / totalOrders) * 100) : 0,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to query execution data" },
      { status: 500 }
    );
  }
}

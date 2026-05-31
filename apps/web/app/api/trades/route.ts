import { NextRequest, NextResponse } from "next/server";
import { queryPaginated, buildOrderBy, QuestDBUnavailableError } from "@/lib/questdb";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { validateTimestamp } from "@/lib/questdb-sanitize";
import { TRADES_SORTABLE_COLUMNS } from "@/lib/columns";
import { prisma } from "@/lib/db";
import type { Trade } from "@/types";

export async function GET(request: NextRequest) {
  const session = await requireAuth();
  if (isAuthError(session)) return session;

  const params = request.nextUrl.searchParams;
  const symbolId = params.get("symbol_id");
  const side = params.get("side");
  const rawLimit = Number(params.get("limit") ?? "25");
  const rawOffset = Number(params.get("offset") ?? "0");
  const limit = Math.max(1, Math.min(1000, Number.isFinite(rawLimit) ? rawLimit : 25));
  const offset = Math.max(0, Number.isFinite(rawOffset) ? rawOffset : 0);
  const start = params.get("start");

  const conditions: string[] = [];

  // The Trades tab shows THIS tenant's executions — fills our platform made in
  // their accounts, attributed to a strategy. The persistence service writes
  // each fill under the tenant's engineId (the public market feed is a
  // separate tenant_id='0' that users never see). Fail closed if no engineId.
  if (typeof session.engineId !== "number") {
    return NextResponse.json({ data: [], total: 0, offset: 0, limit });
  }
  conditions.push(`tenant_id = '${session.engineId}'`);

  const parsedSymbolId = symbolId ? Number(symbolId) : NaN;
  if (Number.isFinite(parsedSymbolId)) conditions.push(`symbol_id = ${parsedSymbolId}`);
  const parsedSide = side !== null && side !== "" ? Number(side) : NaN;
  if (Number.isFinite(parsedSide)) conditions.push(`side = ${parsedSide}`);
  const validStart = start ? validateTimestamp(start) : null;
  if (validStart) conditions.push(`timestamp >= '${validStart}'`);
  const end = params.get("end");
  const validEnd = end ? validateTimestamp(end) : null;
  if (validEnd) conditions.push(`timestamp <= '${validEnd}'`);

  const sort = params.get("sort");
  const dir = params.get("dir");
  const orderBy = buildOrderBy(sort, dir, TRADES_SORTABLE_COLUMNS);

  try {
    const result = await queryPaginated<Trade>(
      "trades",
      conditions,
      limit,
      offset,
      orderBy
    );

    // Attribute each execution to its strategy + account + mode by joining
    // strategy_id (the engine strategy id) back to Postgres. Scoped to this
    // tenant so one tenant can never resolve another's strategy names.
    const engineIds = [
      ...new Set(
        result.data
          .map((t) => Number(t.strategy_id))
          .filter((n) => Number.isFinite(n) && n > 0)
      ),
    ];
    if (engineIds.length > 0) {
      const strategies = await prisma.strategyConfig.findMany({
        where: { tenantId: session.tenantId, engineId: { in: engineIds } },
        select: {
          engineId: true,
          name: true,
          tradingMode: true,
          account: { select: { name: true } },
        },
      });
      const byEngineId = new Map(strategies.map((s) => [s.engineId, s]));
      result.data = result.data.map((t) => {
        const s = byEngineId.get(Number(t.strategy_id));
        return s
          ? { ...t, strategy_name: s.name, account_name: s.account?.name, trading_mode: s.tradingMode }
          : t;
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof QuestDBUnavailableError) {
      return NextResponse.json(
        { error: "Trading data service is not available", data: [], total: 0, offset: 0, limit },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Failed to query trades" },
      { status: 500 }
    );
  }
}

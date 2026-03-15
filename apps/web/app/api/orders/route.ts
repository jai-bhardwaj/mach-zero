import { NextRequest, NextResponse } from "next/server";
import { queryPaginated, buildOrderBy } from "@/lib/questdb";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { validateTradingMode, validateOrderStatus, validateTimestamp } from "@/lib/questdb-sanitize";
import { ORDERS_SORTABLE_COLUMNS } from "@/lib/columns";
import type { Order } from "@/types";

export async function GET(request: NextRequest) {
  const session = await requireAuth();
  if (isAuthError(session)) return session;

  const params = request.nextUrl.searchParams;
  const symbolId = params.get("symbol_id");
  const side = params.get("side");
  const status = params.get("status");
  const rawLimit = Number(params.get("limit") ?? "25");
  const rawOffset = Number(params.get("offset") ?? "0");
  const limit = Math.max(1, Math.min(1000, Number.isFinite(rawLimit) ? rawLimit : 25));
  const offset = Math.max(0, Number.isFinite(rawOffset) ? rawOffset : 0);

  const conditions: string[] = [];

  const parsedSymbolId = symbolId ? Number(symbolId) : NaN;
  if (Number.isFinite(parsedSymbolId)) conditions.push(`symbol_id = ${parsedSymbolId}`);
  const parsedSide = side !== null && side !== "" ? Number(side) : NaN;
  if (Number.isFinite(parsedSide)) conditions.push(`side = ${parsedSide}`);
  const validStatus = status ? validateOrderStatus(status) : null;
  if (validStatus) conditions.push(`status = '${validStatus}'`);
  const tradingMode = params.get("trading_mode");
  const validMode = tradingMode ? validateTradingMode(tradingMode) : null;
  if (validMode) conditions.push(`trading_mode = '${validMode}'`);
  const start = params.get("start");
  const validStart = start ? validateTimestamp(start) : null;
  if (validStart) conditions.push(`timestamp >= '${validStart}'`);
  const end = params.get("end");
  const validEnd = end ? validateTimestamp(end) : null;
  if (validEnd) conditions.push(`timestamp <= '${validEnd}'`);

  const sort = params.get("sort");
  const dir = params.get("dir");
  const orderBy = buildOrderBy(sort, dir, ORDERS_SORTABLE_COLUMNS);

  try {
    const result = await queryPaginated<Order>(
      "orders",
      conditions,
      limit,
      offset,
      orderBy
    );
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to query orders" },
      { status: 500 }
    );
  }
}

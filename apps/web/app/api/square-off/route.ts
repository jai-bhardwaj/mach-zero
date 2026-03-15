import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, isAuthError } from "@/lib/require-auth";

const KILL_SWITCH_URL = process.env.KILL_SWITCH_URL;

// Venue name → SBE enum value
const VENUE_MAP: Record<string, number> = {
  Binance: 1,
  NSE: 2,
  BSE: 3,
};

// POST /api/square-off — Close all open positions for a strategy or tenant
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth("SUPER_ADMIN", "ADMIN", "TRADER");
    if (isAuthError(session)) return session;

    const body = await request.json();
    const { scope, strategyId, activateKillSwitch } = body;

    if (scope === "strategy") {
      return await squareOffStrategy(
        strategyId,
        session.tenantId,
        session.role
      );
    } else if (scope === "tenant") {
      return await squareOffTenant(
        session.tenantId,
        activateKillSwitch !== false
      );
    }

    return NextResponse.json(
      { error: "scope must be 'strategy' or 'tenant'" },
      { status: 400 }
    );
  } catch {
    return NextResponse.json(
      { error: "Square-off failed" },
      { status: 500 }
    );
  }
}

async function squareOffStrategy(
  strategyId: string,
  tenantId: string,
  role: string
) {
  if (!strategyId) {
    return NextResponse.json(
      { error: "strategyId is required for scope=strategy" },
      { status: 400 }
    );
  }

  const strategy = await prisma.strategyConfig.findUnique({
    where: { id: strategyId },
  });

  if (!strategy) {
    return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
  }

  // Tenant isolation
  if (role !== "SUPER_ADMIN" && strategy.tenantId !== tenantId) {
    return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
  }

  if (strategy.status !== "RUNNING" && strategy.status !== "PAUSED") {
    return NextResponse.json(
      { error: `Cannot square off a ${strategy.status} strategy` },
      { status: 400 }
    );
  }

  // Send square-off command to C++ risk monitor
  let cppResult = null;
  if (KILL_SWITCH_URL) {
    try {
      const venueNum = VENUE_MAP[strategy.venue] ?? 1;
      const res = await fetch(`${KILL_SWITCH_URL}/square-off`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbolId: strategy.symbolId,
          venue: venueNum,
        }),
      });
      cppResult = await res.json();
    } catch {
      // C++ engine unavailable — continue with DB update
    }
  }

  // Pause the strategy
  await prisma.strategyConfig.update({
    where: { id: strategyId },
    data: { status: "PAUSED" },
  });

  return NextResponse.json({
    success: true,
    scope: "strategy",
    strategyId,
    strategiesPaused: 1,
    killSwitchActivated: false,
    symbolsSquaredOff: cppResult?.symbolsSquaredOff ?? 0,
    details: cppResult?.details ?? [],
    source: cppResult ? "cpp" : "local",
  });
}

async function squareOffTenant(tenantId: string, activateKillSwitch: boolean) {
  // Send square-off ALL to C++ risk monitor
  let cppResult = null;
  if (KILL_SWITCH_URL) {
    try {
      // Send square-off to all venues with active strategies
      const activeStrategies = await prisma.strategyConfig.findMany({
        where: { tenantId, status: { in: ["RUNNING", "PAUSED"] } },
        select: { venue: true },
      });
      const venues = [...new Set(activeStrategies.map((s) => VENUE_MAP[s.venue] ?? 1))];
      const results = await Promise.all(
        venues.map((venue) =>
          fetch(`${KILL_SWITCH_URL}/square-off`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ all: true, venue }),
          }).then((r) => r.json())
        )
      );
      cppResult = {
        symbolsSquaredOff: results.reduce((sum: number, r: Record<string, unknown>) => sum + (Number(r.symbolsSquaredOff) || 0), 0),
        details: results.flatMap((r: Record<string, unknown>) => (r.details as unknown[]) ?? []),
      };
    } catch {
      // C++ engine unavailable — continue with DB update
    }

    // Activate kill switch
    if (activateKillSwitch) {
      try {
        await fetch(`${KILL_SWITCH_URL}/kill-switch/on`, {
          method: "POST",
        });
      } catch {
        // Best-effort
      }
    }
  }

  // Pause all running/paused strategies for this tenant
  const pauseResult = await prisma.strategyConfig.updateMany({
    where: {
      tenantId,
      status: { in: ["RUNNING", "PAUSED"] },
    },
    data: { status: "PAUSED" },
  });

  return NextResponse.json({
    success: true,
    scope: "tenant",
    tenantId,
    strategiesPaused: pauseResult.count,
    killSwitchActivated: activateKillSwitch,
    symbolsSquaredOff: cppResult?.symbolsSquaredOff ?? 0,
    details: cppResult?.details ?? [],
    source: cppResult ? "cpp" : "local",
  });
}

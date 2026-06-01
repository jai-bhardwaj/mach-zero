import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Internal API that renders active strategies as the exact JSON the C++ engine
// loads from STRATEGIES_FILE (StrategyLoader.h). This is the read side of the
// web->engine config sync: a deploy step or the engine itself can GET this and
// write it to STRATEGIES_FILE. Protected by the same BRIDGE_API_KEY shared
// secret as the credentials endpoint (server-to-server auth).

function validateBridgeApiKey(request: NextRequest): boolean {
  const key = process.env.BRIDGE_API_KEY;
  if (!key) return false;
  const provided =
    request.headers.get("x-bridge-api-key") ??
    request.nextUrl.searchParams.get("apiKey");
  return provided === key;
}

// Web stores StrategyConfig.type as the C++ class name; the engine's
// StrategyLoader expects a snake_case "type" discriminator.
const ENGINE_TYPE: Record<string, string> = {
  SimpleSpreadStrategy: "simple_spread",
  MomentumStrategy: "momentum",
};

// Which params each engine strategy type expects, in addition to the common
// orderQuantity. params are already stored in the engine's fixed-point
// convention (lib/strategy-params), so they pass through unconverted.
const TYPE_PARAM_KEYS: Record<string, string[]> = {
  simple_spread: ["spreadOffset", "orderQuantity"],
  momentum: ["windowSize", "threshold", "orderQuantity"],
};

// GET /api/internal/strategies — STRATEGIES_FILE-shaped JSON for the engine.
export async function GET(request: NextRequest) {
  if (!validateBridgeApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Only RUNNING strategies are sent to the engine; PAUSED/STOPPED/PENDING
    // must not trade. Each tenant's engineId comes from TenantMapping (the
    // uint32 tenant_id on the SBE hot path).
    const configs = await prisma.strategyConfig.findMany({
      where: { status: "RUNNING" },
      select: {
        engineId: true,
        type: true,
        symbolId: true,
        venue: true,
        params: true,
        tenant: { select: { mapping: { select: { engineId: true } } } },
      },
    });

    const strategies = configs
      .map((c) => {
        const engineType = ENGINE_TYPE[c.type];
        const tenantEngineId = c.tenant?.mapping?.engineId;
        // Skip rows the engine can't address: unknown type, or a tenant with no
        // engineId mapping (would otherwise produce untenable tenant_id=0).
        if (!engineType || typeof tenantEngineId !== "number") return null;

        const params = (c.params ?? {}) as Record<string, unknown>;
        const entry: Record<string, unknown> = {
          type: engineType,
          tenantId: tenantEngineId,
          strategyId: c.engineId,
          symbolId: c.symbolId,
          venue: c.venue,
        };
        for (const key of TYPE_PARAM_KEYS[engineType]) {
          if (params[key] !== undefined) entry[key] = params[key];
        }
        return entry;
      })
      .filter(Boolean);

    return NextResponse.json({ version: 1, strategies });
  } catch {
    return NextResponse.json(
      { error: "Failed to render engine strategy config" },
      { status: 500 }
    );
  }
}

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock Prisma — the route reads strategyConfig.findMany with a tenant.mapping join.
const findMany = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: { strategyConfig: { findMany: (...a: unknown[]) => findMany(...a) } },
}));

// The route reads process.env.BRIDGE_API_KEY at request time and has no other
// module-level capture, but re-import per test for isolation.
let GET: typeof import("../route").GET;

const KEY = "test-bridge-key";

function req(headers: Record<string, string> = {}, query = "") {
  return new NextRequest(`http://localhost/api/internal/strategies${query}`, {
    headers,
  });
}

// A RUNNING simple_spread row as Prisma would return it (params already in the
// engine's fixed-point convention; type is the web class name).
const spreadRow = {
  engineId: 1,
  type: "SimpleSpreadStrategy",
  symbolId: 1,
  venue: "Binance",
  params: { spreadOffset: 100000000, orderQuantity: 1000000 },
  tenant: { mapping: { engineId: 1 } },
};

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  vi.stubEnv("BRIDGE_API_KEY", KEY);
  GET = (await import("../route")).GET;
});

describe("auth", () => {
  it("401 without the bridge key", async () => {
    findMany.mockResolvedValue([]);
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("accepts the key via x-bridge-api-key header", async () => {
    findMany.mockResolvedValue([]);
    const res = await GET(req({ "x-bridge-api-key": KEY }));
    expect(res.status).toBe(200);
  });

  it("accepts the key via apiKey query param", async () => {
    findMany.mockResolvedValue([]);
    const res = await GET(req({}, `?apiKey=${KEY}`));
    expect(res.status).toBe(200);
  });
});

describe("STRATEGIES_FILE rendering", () => {
  it("maps a RUNNING simple_spread to the engine JSON shape", async () => {
    findMany.mockResolvedValue([spreadRow]);
    const res = await GET(req({ "x-bridge-api-key": KEY }));
    const body = await res.json();
    expect(body).toEqual({
      version: 1,
      strategies: [
        {
          type: "simple_spread",
          tenantId: 1,
          strategyId: 1,
          symbolId: 1,
          venue: "Binance",
          spreadOffset: 100000000,
          orderQuantity: 1000000,
        },
      ],
    });
    // only RUNNING strategies are sent to the engine
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "RUNNING" } })
    );
  });

  it("maps momentum with its param set", async () => {
    findMany.mockResolvedValue([
      {
        engineId: 2,
        type: "MomentumStrategy",
        symbolId: 2,
        venue: "Binance",
        params: { windowSize: 20, threshold: 500000000, orderQuantity: 100000000 },
        tenant: { mapping: { engineId: 1 } },
      },
    ]);
    const res = await GET(req({ "x-bridge-api-key": KEY }));
    const body = await res.json();
    expect(body.strategies[0]).toEqual({
      type: "momentum",
      tenantId: 1,
      strategyId: 2,
      symbolId: 2,
      venue: "Binance",
      windowSize: 20,
      threshold: 500000000,
      orderQuantity: 100000000,
    });
  });

  it("skips rows with an unknown type or no tenant engineId mapping", async () => {
    findMany.mockResolvedValue([
      { ...spreadRow, type: "UnknownStrategy" }, // unknown type -> skip
      { ...spreadRow, engineId: 9, tenant: { mapping: null } }, // no engineId -> skip
      spreadRow, // valid
    ]);
    const res = await GET(req({ "x-bridge-api-key": KEY }));
    const body = await res.json();
    expect(body.strategies).toHaveLength(1);
    expect(body.strategies[0].strategyId).toBe(1);
  });

  it("omits a missing optional param rather than emitting undefined", async () => {
    findMany.mockResolvedValue([
      { ...spreadRow, params: { spreadOffset: 100000000 } }, // no orderQuantity
    ]);
    const res = await GET(req({ "x-bridge-api-key": KEY }));
    const body = await res.json();
    expect(body.strategies[0]).not.toHaveProperty("orderQuantity");
    expect(body.strategies[0].spreadOffset).toBe(100000000);
  });
});

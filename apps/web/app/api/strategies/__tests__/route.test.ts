import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// Mock auth — return a valid ADMIN session by default
vi.mock("@/lib/require-auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({
    userId: "user-1",
    email: "test@test.com",
    role: "ADMIN",
    tenantId: "tenant-1",
    tenantName: "Test Tenant",
  }),
  isAuthError: vi.fn().mockReturnValue(false),
}));

// Mock Prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    strategyConfig: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    capitalAllocation: {
      delete: vi.fn(),
    },
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
  },
}));

import { GET, POST, PUT, DELETE } from "../route";
import { prisma } from "@/lib/db";

const mockStrategy = {
  id: "strat-1",
  tenantId: "tenant-1",
  accountId: null,
  name: "test-strategy",
  type: "SimpleSpreadStrategy",
  symbolId: 1,
  symbolName: "BTCUSDT",
  venue: "Binance",
  status: "PENDING",
  tradingMode: "MOCK",
  modeChangedAt: null,
  params: { spreadOffset: 100 },
  maxPositionLimit: null,
  maxOrderRate: null,
  maxDrawdown: null,
  riskMultiplier: 1.0,
  allocation: null,
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ── GET ──────────────────────────────────────────────────────────────

describe("GET /api/strategies", () => {
  it("returns all strategies ordered by updatedAt desc", async () => {
    vi.mocked(prisma.strategyConfig.findMany).mockResolvedValue([mockStrategy] as never);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("test-strategy");
  });

  it("returns 500 when prisma throws", async () => {
    vi.mocked(prisma.strategyConfig.findMany).mockRejectedValue(new Error("DB error"));

    const res = await GET();
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain("Failed to fetch");
  });
});

// ── POST ─────────────────────────────────────────────────────────────

describe("POST /api/strategies", () => {
  function makePost(body: Record<string, unknown>) {
    return new NextRequest("http://localhost/api/strategies", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
  }

  const validBody = {
    name: "new-strategy",
    type: "SimpleSpreadStrategy",
    symbolId: 1,
    symbolName: "BTCUSDT",
    venue: "Binance",
    params: { spreadOffset: 50 },
  };

  it("creates a strategy with status=PENDING and tradingMode=MOCK", async () => {
    vi.mocked(prisma.strategyConfig.create).mockResolvedValue({
      ...mockStrategy,
      ...validBody,
    } as never);

    const res = await POST(makePost(validBody));
    expect(res.status).toBe(201);

    expect(prisma.strategyConfig.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PENDING",
          tradingMode: "MOCK",
          riskMultiplier: 1.0,
        }),
      })
    );
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await POST(makePost({ }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("required");
  });

  it("returns 400 when name is missing", async () => {
    const { name: _unused, ...body } = validBody;
    void _unused;
    const res = await POST(makePost(body));
    expect(res.status).toBe(400);
  });
});

// ── PUT ──────────────────────────────────────────────────────────────

describe("PUT /api/strategies", () => {
  function makePut(body: Record<string, unknown>) {
    return new NextRequest("http://localhost/api/strategies", {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
  }

  it("returns 400 when id is missing", async () => {
    const res = await PUT(makePut({ status: "RUNNING" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when strategy not found", async () => {
    vi.mocked(prisma.strategyConfig.findUnique).mockResolvedValue(null);
    const res = await PUT(makePut({ id: "nonexistent", status: "RUNNING" }));
    expect(res.status).toBe(404);
  });

  it("allows PENDING → RUNNING transition", async () => {
    vi.mocked(prisma.strategyConfig.findUnique).mockResolvedValue(
      { ...mockStrategy, status: "PENDING" } as never
    );
    vi.mocked(prisma.strategyConfig.update).mockResolvedValue(
      { ...mockStrategy, status: "RUNNING" } as never
    );

    const res = await PUT(makePut({ id: "strat-1", status: "RUNNING" }));
    expect(res.status).toBe(200);
  });

  it("allows RUNNING → PAUSED transition", async () => {
    vi.mocked(prisma.strategyConfig.findUnique).mockResolvedValue(
      { ...mockStrategy, status: "RUNNING" } as never
    );
    vi.mocked(prisma.strategyConfig.update).mockResolvedValue(
      { ...mockStrategy, status: "PAUSED" } as never
    );

    const res = await PUT(makePut({ id: "strat-1", status: "PAUSED" }));
    expect(res.status).toBe(200);
  });

  it("allows RUNNING → STOPPED transition", async () => {
    vi.mocked(prisma.strategyConfig.findUnique).mockResolvedValue(
      { ...mockStrategy, status: "RUNNING" } as never
    );
    vi.mocked(prisma.strategyConfig.update).mockResolvedValue(
      { ...mockStrategy, status: "STOPPED" } as never
    );

    const res = await PUT(makePut({ id: "strat-1", status: "STOPPED" }));
    expect(res.status).toBe(200);
  });

  it("allows PAUSED → RUNNING transition", async () => {
    vi.mocked(prisma.strategyConfig.findUnique).mockResolvedValue(
      { ...mockStrategy, status: "PAUSED" } as never
    );
    vi.mocked(prisma.strategyConfig.update).mockResolvedValue(
      { ...mockStrategy, status: "RUNNING" } as never
    );

    const res = await PUT(makePut({ id: "strat-1", status: "RUNNING" }));
    expect(res.status).toBe(200);
  });

  it("allows PAUSED → STOPPED transition", async () => {
    vi.mocked(prisma.strategyConfig.findUnique).mockResolvedValue(
      { ...mockStrategy, status: "PAUSED" } as never
    );
    vi.mocked(prisma.strategyConfig.update).mockResolvedValue(
      { ...mockStrategy, status: "STOPPED" } as never
    );

    const res = await PUT(makePut({ id: "strat-1", status: "STOPPED" }));
    expect(res.status).toBe(200);
  });

  it("allows STOPPED → RUNNING transition", async () => {
    vi.mocked(prisma.strategyConfig.findUnique).mockResolvedValue(
      { ...mockStrategy, status: "STOPPED" } as never
    );
    vi.mocked(prisma.strategyConfig.update).mockResolvedValue(
      { ...mockStrategy, status: "RUNNING" } as never
    );

    const res = await PUT(makePut({ id: "strat-1", status: "RUNNING" }));
    expect(res.status).toBe(200);
  });

  it("rejects PENDING → PAUSED transition", async () => {
    vi.mocked(prisma.strategyConfig.findUnique).mockResolvedValue(
      { ...mockStrategy, status: "PENDING" } as never
    );

    const res = await PUT(makePut({ id: "strat-1", status: "PAUSED" }));
    expect(res.status).toBe(400);
  });

  it("returns 428 when switching to LIVE without liveConfirm", async () => {
    vi.mocked(prisma.strategyConfig.findUnique).mockResolvedValue(
      { ...mockStrategy, tradingMode: "MOCK" } as never
    );

    const res = await PUT(makePut({ id: "strat-1", tradingMode: "LIVE" }));
    expect(res.status).toBe(428);
    const data = await res.json();
    expect(data.error).toContain("LIVE_MODE_CONFIRMATION_REQUIRED");
  });

  it("returns 428 when starting in LIVE mode without liveConfirm", async () => {
    vi.mocked(prisma.strategyConfig.findUnique).mockResolvedValue(
      { ...mockStrategy, status: "PENDING", tradingMode: "LIVE", allocation: { id: "alloc-1" } } as never
    );

    const res = await PUT(makePut({ id: "strat-1", status: "RUNNING" }));
    expect(res.status).toBe(428);
  });

  it("returns 400 when starting LIVE strategy without capital allocation", async () => {
    vi.mocked(prisma.strategyConfig.findUnique).mockResolvedValue(
      { ...mockStrategy, status: "PENDING", tradingMode: "LIVE", allocation: null } as never
    );

    const res = await PUT(
      makePut({ id: "strat-1", status: "RUNNING", liveConfirm: true })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("capital allocation");
  });

  it("allows starting MOCK strategy without capital allocation", async () => {
    vi.mocked(prisma.strategyConfig.findUnique).mockResolvedValue(
      { ...mockStrategy, status: "PENDING", tradingMode: "MOCK", allocation: null } as never
    );
    vi.mocked(prisma.strategyConfig.update).mockResolvedValue(
      { ...mockStrategy, status: "RUNNING" } as never
    );

    const res = await PUT(makePut({ id: "strat-1", status: "RUNNING" }));
    expect(res.status).toBe(200);
  });

  it("updates params when provided", async () => {
    vi.mocked(prisma.strategyConfig.findUnique).mockResolvedValue(mockStrategy as never);
    vi.mocked(prisma.strategyConfig.update).mockResolvedValue(mockStrategy as never);

    await PUT(makePut({ id: "strat-1", params: { newParam: 42 } }));

    expect(prisma.strategyConfig.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ params: { newParam: 42 } }),
      })
    );
  });

  it("sets modeChangedAt when tradingMode changes", async () => {
    vi.mocked(prisma.strategyConfig.findUnique).mockResolvedValue(
      { ...mockStrategy, tradingMode: "MOCK" } as never
    );
    vi.mocked(prisma.strategyConfig.update).mockResolvedValue(mockStrategy as never);

    await PUT(
      makePut({ id: "strat-1", tradingMode: "LIVE", liveConfirm: true })
    );

    expect(prisma.strategyConfig.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tradingMode: "LIVE",
          modeChangedAt: expect.any(Date),
        }),
      })
    );
  });
});

// ── DELETE ────────────────────────────────────────────────────────────

describe("DELETE /api/strategies", () => {
  it("returns 400 when id param is missing", async () => {
    const req = new NextRequest("http://localhost/api/strategies");
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when strategy not found", async () => {
    vi.mocked(prisma.strategyConfig.findUnique).mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/strategies?id=nonexistent");
    const res = await DELETE(req);
    expect(res.status).toBe(404);
  });

  it("returns 400 when trying to delete a RUNNING strategy", async () => {
    vi.mocked(prisma.strategyConfig.findUnique).mockResolvedValue(
      { ...mockStrategy, status: "RUNNING" } as never
    );

    const req = new NextRequest("http://localhost/api/strategies?id=strat-1");
    const res = await DELETE(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("STOPPED or PENDING");
  });

  it("returns 400 when trying to delete a PAUSED strategy", async () => {
    vi.mocked(prisma.strategyConfig.findUnique).mockResolvedValue(
      { ...mockStrategy, status: "PAUSED" } as never
    );

    const req = new NextRequest("http://localhost/api/strategies?id=strat-1");
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });

  it("deletes STOPPED strategy successfully", async () => {
    vi.mocked(prisma.strategyConfig.findUnique).mockResolvedValue(
      { ...mockStrategy, status: "STOPPED", allocation: null } as never
    );

    const req = new NextRequest("http://localhost/api/strategies?id=strat-1");
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.deleted).toBe(true);
  });

  it("deletes PENDING strategy successfully", async () => {
    vi.mocked(prisma.strategyConfig.findUnique).mockResolvedValue(
      { ...mockStrategy, status: "PENDING", allocation: null } as never
    );

    const req = new NextRequest("http://localhost/api/strategies?id=strat-1");
    const res = await DELETE(req);
    expect(res.status).toBe(200);
  });

  it("deletes capital allocation before strategy via $transaction", async () => {
    vi.mocked(prisma.strategyConfig.findUnique).mockResolvedValue(
      { ...mockStrategy, status: "STOPPED", allocation: { id: "alloc-1" } } as never
    );

    const req = new NextRequest("http://localhost/api/strategies?id=strat-1");
    await DELETE(req);

    expect(prisma.$transaction).toHaveBeenCalled();
  });
});

// ── AUTH ─────────────────────────────────────────────────────────────

describe("Auth enforcement", () => {
  it("returns 401 when not authenticated", async () => {
    const { requireAuth, isAuthError } = await import("@/lib/require-auth");
    const unauthRes = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(requireAuth).mockResolvedValueOnce(unauthRes);
    vi.mocked(isAuthError).mockReturnValueOnce(true);

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 when role is insufficient for POST", async () => {
    const { requireAuth, isAuthError } = await import("@/lib/require-auth");
    const forbiddenRes = NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    vi.mocked(requireAuth).mockResolvedValueOnce(forbiddenRes);
    vi.mocked(isAuthError).mockReturnValueOnce(true);

    const req = new NextRequest("http://localhost/api/strategies", {
      method: "POST",
      body: JSON.stringify({ name: "test" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });
});

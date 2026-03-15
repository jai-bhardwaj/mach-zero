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
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

// Mock global fetch (for C++ proxy calls)
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { prisma } from "@/lib/db";

// Dynamic import because the route captures KILL_SWITCH_URL at module level
let POST: typeof import("../route").POST;

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/square-off", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const mockStrategy = {
  id: "strat-1",
  tenantId: "tenant-1",
  name: "test-strategy",
  symbolId: 1,
  symbolName: "BTCUSDT",
  venue: "Binance",
  status: "RUNNING",
  tradingMode: "MOCK",
};

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  vi.stubEnv("KILL_SWITCH_URL", "http://localhost:9090");
  const mod = await import("../route");
  POST = mod.POST;
});

describe("POST /api/square-off", () => {
  describe("scope=strategy", () => {
    it("returns 400 when strategyId is missing", async () => {
      const res = await POST(makeRequest({ scope: "strategy" }));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("strategyId is required");
    });

    it("returns 404 when strategy not found", async () => {
      vi.mocked(prisma.strategyConfig.findUnique).mockResolvedValue(null);
      const res = await POST(makeRequest({ scope: "strategy", strategyId: "nonexistent" }));
      expect(res.status).toBe(404);
    });

    it("returns 400 when strategy is STOPPED", async () => {
      vi.mocked(prisma.strategyConfig.findUnique).mockResolvedValue({
        ...mockStrategy,
        status: "STOPPED",
      } as never);
      const res = await POST(makeRequest({ scope: "strategy", strategyId: "strat-1" }));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("STOPPED");
    });

    it("pauses a RUNNING strategy and returns success", async () => {
      vi.mocked(prisma.strategyConfig.findUnique).mockResolvedValue(mockStrategy as never);
      vi.mocked(prisma.strategyConfig.update).mockResolvedValue({ ...mockStrategy, status: "PAUSED" } as never);
      mockFetch.mockResolvedValue({
        json: async () => ({ symbolsSquaredOff: 1, details: [] }),
      });

      const res = await POST(makeRequest({ scope: "strategy", strategyId: "strat-1" }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.strategiesPaused).toBe(1);
      expect(prisma.strategyConfig.update).toHaveBeenCalledWith({
        where: { id: "strat-1" },
        data: { status: "PAUSED" },
      });
    });

    it("calls C++ /square-off with correct venue mapping", async () => {
      vi.mocked(prisma.strategyConfig.findUnique).mockResolvedValue(mockStrategy as never);
      vi.mocked(prisma.strategyConfig.update).mockResolvedValue({ ...mockStrategy, status: "PAUSED" } as never);
      mockFetch.mockResolvedValue({
        json: async () => ({ symbolsSquaredOff: 0, details: [] }),
      });

      await POST(makeRequest({ scope: "strategy", strategyId: "strat-1" }));

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:9090/square-off",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ symbolId: 1, venue: 1 }),
        })
      );
    });

    it("falls back gracefully when C++ engine is unavailable", async () => {
      vi.mocked(prisma.strategyConfig.findUnique).mockResolvedValue(mockStrategy as never);
      vi.mocked(prisma.strategyConfig.update).mockResolvedValue({ ...mockStrategy, status: "PAUSED" } as never);
      mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

      const res = await POST(makeRequest({ scope: "strategy", strategyId: "strat-1" }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.source).toBe("local");
    });

    it("returns source=cpp when C++ responds", async () => {
      vi.mocked(prisma.strategyConfig.findUnique).mockResolvedValue(mockStrategy as never);
      vi.mocked(prisma.strategyConfig.update).mockResolvedValue({ ...mockStrategy, status: "PAUSED" } as never);
      mockFetch.mockResolvedValue({
        json: async () => ({ symbolsSquaredOff: 1, details: [{ symbolId: 1, position: -500, closingSide: "Buy" }] }),
      });

      const res = await POST(makeRequest({ scope: "strategy", strategyId: "strat-1" }));
      const data = await res.json();

      expect(data.source).toBe("cpp");
      expect(data.symbolsSquaredOff).toBe(1);
    });
  });

  describe("scope=tenant", () => {
    it("pauses all RUNNING/PAUSED strategies using session tenantId", async () => {
      vi.mocked(prisma.strategyConfig.updateMany).mockResolvedValue({ count: 2 } as never);
      mockFetch.mockResolvedValue({
        json: async () => ({ symbolsSquaredOff: 2, details: [] }),
      });

      const res = await POST(
        makeRequest({ scope: "tenant", activateKillSwitch: true })
      );
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.strategiesPaused).toBe(2);
      expect(data.tenantId).toBe("tenant-1");
    });

    it("activates kill switch when flag is true", async () => {
      vi.mocked(prisma.strategyConfig.updateMany).mockResolvedValue({ count: 1 } as never);
      mockFetch.mockResolvedValue({
        json: async () => ({}),
      });

      const res = await POST(
        makeRequest({ scope: "tenant", activateKillSwitch: true })
      );
      const data = await res.json();

      expect(data.killSwitchActivated).toBe(true);
      // Should have called kill-switch/on endpoint
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:9090/kill-switch/on",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("succeeds when C++ engine is unavailable", async () => {
      vi.mocked(prisma.strategyConfig.updateMany).mockResolvedValue({ count: 1 } as never);
      mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

      const res = await POST(
        makeRequest({ scope: "tenant" })
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.source).toBe("local");
    });
  });

  it("returns 400 for invalid scope", async () => {
    const res = await POST(makeRequest({ scope: "invalid" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("scope must be");
  });

  describe("Auth enforcement", () => {
    it("returns 401 when not authenticated", async () => {
      const { requireAuth, isAuthError } = await import("@/lib/require-auth");
      const unauthRes = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      vi.mocked(requireAuth).mockResolvedValueOnce(unauthRes);
      vi.mocked(isAuthError).mockReturnValueOnce(true);

      const res = await POST(makeRequest({ scope: "strategy", strategyId: "strat-1" }));
      expect(res.status).toBe(401);
    });

    it("returns 403 when role is insufficient", async () => {
      const { requireAuth, isAuthError } = await import("@/lib/require-auth");
      const forbiddenRes = NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
      vi.mocked(requireAuth).mockResolvedValueOnce(forbiddenRes);
      vi.mocked(isAuthError).mockReturnValueOnce(true);

      const res = await POST(makeRequest({ scope: "strategy", strategyId: "strat-1" }));
      expect(res.status).toBe(403);
    });
  });
});

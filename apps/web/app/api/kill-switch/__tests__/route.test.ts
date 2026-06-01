import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// Mock auth — must come before route import
vi.mock("@/lib/require-auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({
    userId: "user-1",
    email: "test@test.com",
    role: "ADMIN",
    tenantId: "tenant-1",
    tenantName: "Test Tenant",
    engineId: 1,
  }),
  isAuthError: vi.fn().mockReturnValue(false),
}));

// Mock Prisma — kill-switch route audit-logs and resolves tenant UUIDs
vi.mock("@/lib/db", () => ({
  prisma: {
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    tenantMapping: { findUnique: vi.fn().mockResolvedValue(null) },
  },
}));

// Alert evaluator is fire-and-forget; stub it
vi.mock("@/lib/alert-evaluator", () => ({
  evaluateAlerts: vi.fn().mockResolvedValue(undefined),
}));

// Mock global fetch for C++ proxy calls
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// We need to re-import the module for each test because it has module-level
// mutable state (killSwitchActive) and captures KILL_SWITCH_URL at import time.
let GET: typeof import("../route").GET;
let POST: typeof import("../route").POST;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  vi.stubEnv("KILL_SWITCH_URL", "http://localhost:9090");
  const mod = await import("../route");
  GET = mod.GET;
  POST = mod.POST;
});

describe("GET /api/kill-switch", () => {
  it("proxies to C++ /status when KILL_SWITCH_URL is set", async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({ killSwitch: false, trades: 100 }),
    });

    const res = await GET();
    const data = await res.json();

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:9090/status",
      expect.objectContaining({ cache: "no-store" })
    );
    expect(data.killSwitch).toBe(false);
  });

  it("falls back to local state when C++ engine is unreachable", async () => {
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.killSwitch).toBe(false);
    expect(data.source).toBe("fallback");
  });

  it("returns source=local when KILL_SWITCH_URL is not set", async () => {
    vi.resetModules();
    vi.stubEnv("KILL_SWITCH_URL", "");
    const mod = await import("../route");

    const res = await mod.GET();
    const data = await res.json();

    expect(data.source).toBe("local");
    expect(data.killSwitch).toBe(false);
  });
});

describe("POST /api/kill-switch", () => {
  it("returns 400 when state is not 'on' or 'off'", async () => {
    const req = new NextRequest("http://localhost/api/kill-switch", {
      method: "POST",
      body: JSON.stringify({ state: "invalid" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("'on' or 'off'");
  });

  it("proxies to C++ /kill-switch/on when KILL_SWITCH_URL is set", async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({ killSwitch: true, action: "activated" }),
    });

    const req = new NextRequest("http://localhost/api/kill-switch", {
      method: "POST",
      body: JSON.stringify({ state: "on" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:9090/kill-switch/on",
      expect.objectContaining({ method: "POST" })
    );
    expect(data.killSwitch).toBe(true);
  });

  it("proxies to C++ /kill-switch/off when KILL_SWITCH_URL is set", async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({ killSwitch: false, action: "deactivated" }),
    });

    const req = new NextRequest("http://localhost/api/kill-switch", {
      method: "POST",
      body: JSON.stringify({ state: "off" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:9090/kill-switch/off",
      expect.objectContaining({ method: "POST" })
    );
    expect(data.killSwitch).toBe(false);
  });

  it("toggles local state when C++ engine is unreachable", async () => {
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

    // Activate
    const req1 = new NextRequest("http://localhost/api/kill-switch", {
      method: "POST",
      body: JSON.stringify({ state: "on" }),
      headers: { "Content-Type": "application/json" },
    });
    const res1 = await POST(req1);
    const data1 = await res1.json();
    expect(data1.killSwitch).toBe(true);
    expect(data1.source).toBe("fallback");

    // Deactivate
    const req2 = new NextRequest("http://localhost/api/kill-switch", {
      method: "POST",
      body: JSON.stringify({ state: "off" }),
      headers: { "Content-Type": "application/json" },
    });
    const res2 = await POST(req2);
    const data2 = await res2.json();
    expect(data2.killSwitch).toBe(false);
  });
});

describe("killSwitch normalization (real C++ string payloads)", () => {
  // The C++ risk monitor returns killSwitch as the strings "activated" /
  // "deactivated" on the POST endpoints (and could on /status). The route must
  // normalize these to booleans so clients never coerce a truthy "deactivated".
  it("GET normalizes string 'activated' -> true and sets source=monitor", async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({ killSwitch: "activated", tradesProcessed: 5 }),
    });

    const res = await GET();
    const data = await res.json();

    expect(data.killSwitch).toBe(true);
    expect(typeof data.killSwitch).toBe("boolean");
    expect(data.source).toBe("monitor");
  });

  it("POST on normalizes string 'activated' -> true (the optimistic-update bug)", async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({ killSwitch: "activated" }),
    });

    const req = new NextRequest("http://localhost/api/kill-switch", {
      method: "POST",
      body: JSON.stringify({ state: "on" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(data.killSwitch).toBe(true);
    expect(typeof data.killSwitch).toBe("boolean");
  });

  it("POST off normalizes string 'deactivated' -> false", async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({ killSwitch: "deactivated" }),
    });

    const req = new NextRequest("http://localhost/api/kill-switch", {
      method: "POST",
      body: JSON.stringify({ state: "off" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(data.killSwitch).toBe(false);
    expect(typeof data.killSwitch).toBe("boolean");
  });
});

describe("Auth enforcement", () => {
  it("returns 401 when not authenticated on GET", async () => {
    const { requireAuth, isAuthError } = await import("@/lib/require-auth");
    const unauthRes = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(requireAuth).mockResolvedValueOnce(unauthRes);
    vi.mocked(isAuthError).mockReturnValueOnce(true);

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 when non-ADMIN tries POST", async () => {
    const { requireAuth, isAuthError } = await import("@/lib/require-auth");
    const forbiddenRes = NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    vi.mocked(requireAuth).mockResolvedValueOnce(forbiddenRes);
    vi.mocked(isAuthError).mockReturnValueOnce(true);

    const req = new NextRequest("http://localhost/api/kill-switch", {
      method: "POST",
      body: JSON.stringify({ state: "on" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });
});

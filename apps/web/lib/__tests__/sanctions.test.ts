import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import {
  isSanctionedCountry,
  detectCountry,
  evaluateGeoblock,
} from "../sanctions";

afterEach(() => {
  vi.unstubAllEnvs();
});

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/", { headers });
}

describe("isSanctionedCountry", () => {
  it.each(["IR", "KP", "CU", "SY", "RU", "BY"])(
    "marks %s as sanctioned",
    (c) => expect(isSanctionedCountry(c)).toBe(true)
  );

  it("is case-insensitive", () => {
    expect(isSanctionedCountry("ir")).toBe(true);
    expect(isSanctionedCountry("kp")).toBe(true);
  });

  it.each(["US", "GB", "DE", "JP", "IN", "AE", "SG"])(
    "does not mark %s as sanctioned",
    (c) => expect(isSanctionedCountry(c)).toBe(false)
  );

  it.each([null, undefined, ""])("treats %j as not sanctioned", (c) => {
    expect(isSanctionedCountry(c)).toBe(false);
  });
});

describe("detectCountry", () => {
  it("reads x-vercel-ip-country", () => {
    const req = makeRequest({ "x-vercel-ip-country": "US" });
    expect(detectCountry(req)).toBe("US");
  });

  it("falls back to cf-ipcountry", () => {
    const req = makeRequest({ "cf-ipcountry": "DE" });
    expect(detectCountry(req)).toBe("DE");
  });

  it("falls back to x-country-code", () => {
    const req = makeRequest({ "x-country-code": "GB" });
    expect(detectCountry(req)).toBe("GB");
  });

  it("returns null when no header is set", () => {
    expect(detectCountry(makeRequest())).toBeNull();
  });
});

describe("evaluateGeoblock", () => {
  it("blocks sanctioned countries", () => {
    const req = makeRequest({ "x-vercel-ip-country": "IR" });
    const result = evaluateGeoblock(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("sanctioned");
      expect(result.country).toBe("IR");
    }
  });

  it("allows non-sanctioned countries", () => {
    const req = makeRequest({ "x-vercel-ip-country": "US" });
    const result = evaluateGeoblock(req);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.country).toBe("US");
  });

  it("fails closed in production when country is missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BYPASS_GEOBLOCK", "");
    const result = evaluateGeoblock(makeRequest());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unknown");
  });

  it("allows in dev when country is missing", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(evaluateGeoblock(makeRequest()).ok).toBe(true);
  });

  it("BYPASS_GEOBLOCK overrides fail-closed in production (incident escape hatch)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BYPASS_GEOBLOCK", "1");
    expect(evaluateGeoblock(makeRequest()).ok).toBe(true);
  });

  it("BYPASS_GEOBLOCK does NOT override the sanctioned-country check", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BYPASS_GEOBLOCK", "1");
    const req = makeRequest({ "x-vercel-ip-country": "KP" });
    const result = evaluateGeoblock(req);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("sanctioned");
  });
});

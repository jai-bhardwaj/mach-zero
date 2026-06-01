import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  syncStrategies,
  validateEngineConfig,
  writeIfChanged,
  stableStringify,
} from "../sync-strategies";

const VALID = {
  version: 1,
  strategies: [
    { type: "simple_spread", tenantId: 1, strategyId: 1, symbolId: 1, venue: "Binance", spreadOffset: 100000000, orderQuantity: 1000000 },
  ],
};

function okFetch(body: unknown, status = 200): typeof fetch {
  return (async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })) as unknown as typeof fetch;
}

let dir: string;
let target: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "mz-sync-"));
  target = join(dir, "strategies.json");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("validateEngineConfig", () => {
  it("accepts a well-formed config", () => {
    expect(validateEngineConfig(VALID).strategies).toHaveLength(1);
  });
  it("rejects missing version / strategies / bad ids", () => {
    expect(() => validateEngineConfig({ strategies: [] })).toThrow(/version/);
    expect(() => validateEngineConfig({ version: 1 })).toThrow(/strategies/);
    // use a valid type so these exercise the id checks, not the type check
    const base = { type: "simple_spread", orderQuantity: 1, symbolId: 1, tenantId: 1 };
    expect(() => validateEngineConfig({ version: 1, strategies: [{ ...base, tenantId: 0 }] })).toThrow(/tenantId/);
    expect(() => validateEngineConfig({ version: 1, strategies: [{ ...base, symbolId: 0 }] })).toThrow(/symbolId/);
  });

  // The validator must mirror the engine's StrategyLoader, which FATAL-rejects
  // the whole file on these — catch them at the sync boundary instead.
  it("rejects an unknown strategy type (engine would reject the whole file)", () => {
    expect(() =>
      validateEngineConfig({ version: 1, strategies: [{ type: "grid", tenantId: 1, symbolId: 1, orderQuantity: 1 }] })
    ).toThrow(/type/);
  });
  it("rejects an unknown venue but allows it absent (engine defaults to Binance)", () => {
    expect(() =>
      validateEngineConfig({ version: 1, strategies: [{ type: "simple_spread", tenantId: 1, symbolId: 1, orderQuantity: 1, venue: "Kraken" }] })
    ).toThrow(/venue/);
    // venue omitted is fine
    expect(
      validateEngineConfig({ version: 1, strategies: [{ type: "simple_spread", tenantId: 1, symbolId: 1, orderQuantity: 1 }] }).strategies
    ).toHaveLength(1);
  });
  it("rejects orderQuantity <= 0 or missing (engine FATALs on 0)", () => {
    expect(() =>
      validateEngineConfig({ version: 1, strategies: [{ type: "simple_spread", tenantId: 1, symbolId: 1, orderQuantity: 0 }] })
    ).toThrow(/orderQuantity/);
    expect(() =>
      validateEngineConfig({ version: 1, strategies: [{ type: "momentum", tenantId: 1, symbolId: 2 }] })
    ).toThrow(/orderQuantity/);
  });
});

describe("writeIfChanged", () => {
  it("writes when the file does not exist", () => {
    const r = writeIfChanged(target, VALID);
    expect(r.status).toBe("written");
    expect(JSON.parse(readFileSync(target, "utf8"))).toEqual(VALID);
  });
  it("is idempotent: second identical write is a no-op", () => {
    writeIfChanged(target, VALID);
    const r = writeIfChanged(target, VALID);
    expect(r.status).toBe("unchanged");
  });
  it("ignores formatting differences (canonical compare)", () => {
    // existing file is the same config but minified / key-reordered
    writeFileSync(target, JSON.stringify({ strategies: VALID.strategies, version: 1 }), "utf8");
    const r = writeIfChanged(target, VALID);
    expect(r.status).toBe("unchanged");
  });
  it("rewrites when content actually changed", () => {
    writeIfChanged(target, VALID);
    const changed = { ...VALID, strategies: [{ ...VALID.strategies[0], orderQuantity: 2000000 }] };
    const r = writeIfChanged(target, changed);
    expect(r.status).toBe("written");
    expect(JSON.parse(readFileSync(target, "utf8")).strategies[0].orderQuantity).toBe(2000000);
  });
  it("leaves no .tmp turds behind (atomic rename)", () => {
    writeIfChanged(target, VALID);
    const leftovers = readdirSync(dir).filter((f) => f.includes(".tmp"));
    expect(leftovers).toEqual([]);
  });
  it("overwrites a corrupt existing file with valid config", () => {
    writeFileSync(target, "{ this is not json", "utf8");
    const r = writeIfChanged(target, VALID);
    expect(r.status).toBe("written");
    expect(JSON.parse(readFileSync(target, "utf8"))).toEqual(VALID);
  });
});

describe("syncStrategies (fetch + write)", () => {
  it("writes a valid fetched config", async () => {
    const r = await syncStrategies({ url: "http://x/", apiKey: "k", targetPath: target, fetchImpl: okFetch(VALID) });
    expect(r.status).toBe("written");
    expect(existsSync(target)).toBe(true);
  });

  it("sends the bridge key header", async () => {
    let sentKey: string | undefined;
    const spyFetch = (async (_url: string, init?: RequestInit) => {
      sentKey = (init?.headers as Record<string, string>)?.["x-bridge-api-key"];
      return { ok: true, status: 200, json: async () => VALID };
    }) as unknown as typeof fetch;
    await syncStrategies({ url: "http://x/", apiKey: "secret-123", targetPath: target, fetchImpl: spyFetch });
    expect(sentKey).toBe("secret-123");
  });

  it("non-200 -> error and DOES NOT clobber an existing good file", async () => {
    writeIfChanged(target, VALID); // existing good config
    const before = readFileSync(target, "utf8");
    const r = await syncStrategies({ url: "http://x/", apiKey: "k", targetPath: target, fetchImpl: okFetch({}, 401) });
    expect(r.status).toBe("error");
    expect(r.message).toMatch(/401/);
    expect(readFileSync(target, "utf8")).toBe(before); // untouched
  });

  it("invalid shape -> error and does not write", async () => {
    const r = await syncStrategies({ url: "http://x/", apiKey: "k", targetPath: target, fetchImpl: okFetch({ nope: true }) });
    expect(r.status).toBe("error");
    expect(existsSync(target)).toBe(false);
  });

  it("network throw -> error, no write", async () => {
    const boom = (async () => { throw new Error("ECONNREFUSED"); }) as unknown as typeof fetch;
    const r = await syncStrategies({ url: "http://x/", apiKey: "k", targetPath: target, fetchImpl: boom });
    expect(r.status).toBe("error");
    expect(r.message).toMatch(/ECONNREFUSED/);
    expect(existsSync(target)).toBe(false);
  });
});

describe("stableStringify", () => {
  it("is order-independent for object keys", () => {
    expect(stableStringify({ a: 1, b: 2 })).toBe(stableStringify({ b: 2, a: 1 }));
  });
});

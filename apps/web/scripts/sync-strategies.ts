/**
 * sync-strategies — pull the engine's STRATEGIES_FILE config from the web and
 * write it to disk for the C++ strategy engine to load.
 *
 * Transport for the web->engine strategy sync: a deploy step / cron / systemd
 * timer on the engine host runs this periodically. It GETs
 * /api/internal/strategies (which renders RUNNING strategies as the exact JSON
 * StrategyLoader expects), and writes STRATEGIES_FILE atomically, only when the
 * content actually changed.
 *
 * Chosen over an always-on poller-service or web-push-over-SSH because it adds
 * no long-lived process in the trading hot path and no inbound port on the
 * engine; it's idempotent and safe to run on any cadence.
 *
 * Hot-reload (engine re-reading the file without a restart) is a SEPARATE C++
 * concern — this script just keeps the file current.
 *
 * Env:
 *   STRATEGIES_SYNC_URL  full URL to GET (default http://localhost:3000/api/internal/strategies)
 *   BRIDGE_API_KEY       shared secret for the internal endpoint (required)
 *   STRATEGIES_FILE      target path to write (default /tmp/mz_strategies_fill.json)
 *
 * Exit codes: 0 = wrote a change | 0 = unchanged (no-op) | non-zero = error
 * (network/auth/invalid-shape). On error the existing target file is left
 * untouched — a bad fetch must never clobber a known-good config.
 */
import { writeFileSync, renameSync, readFileSync, existsSync } from "node:fs";
import { dirname, basename, join } from "node:path";

export interface SyncResult {
  status: "written" | "unchanged" | "error";
  message: string;
}

interface EngineStrategy {
  type: string;
  tenantId: number;
  strategyId: number;
  symbolId: number;
  venue: string;
  [k: string]: unknown;
}
interface EngineConfig {
  version: number;
  strategies: EngineStrategy[];
}

/** Validate the payload is the shape StrategyLoader can consume. Throws on bad. */
export function validateEngineConfig(data: unknown): EngineConfig {
  if (!data || typeof data !== "object") throw new Error("payload is not an object");
  const cfg = data as Record<string, unknown>;
  if (typeof cfg.version !== "number") throw new Error("missing numeric 'version'");
  if (!Array.isArray(cfg.strategies)) throw new Error("missing 'strategies' array");
  for (const [i, s] of cfg.strategies.entries()) {
    const st = s as Record<string, unknown>;
    if (typeof st.type !== "string") throw new Error(`strategy[${i}] missing 'type'`);
    if (typeof st.tenantId !== "number" || st.tenantId <= 0)
      throw new Error(`strategy[${i}] invalid 'tenantId' (must be > 0)`);
    if (typeof st.symbolId !== "number" || st.symbolId <= 0)
      throw new Error(`strategy[${i}] invalid 'symbolId' (must be > 0)`);
  }
  return cfg as unknown as EngineConfig;
}

/** Stable serialization for change-detection: sorted keys, no insignificant whitespace. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

/**
 * Write `cfg` to `targetPath` atomically (temp file + rename), but only if the
 * canonical content differs from what's already there. Pure aside from fs.
 */
export function writeIfChanged(targetPath: string, cfg: EngineConfig): SyncResult {
  const next = stableStringify(cfg);
  if (existsSync(targetPath)) {
    try {
      const current = readFileSync(targetPath, "utf8");
      // Compare canonical forms so formatting differences don't trigger a write.
      const currentCanon = stableStringify(JSON.parse(current));
      if (currentCanon === next) {
        return { status: "unchanged", message: `no change (${cfg.strategies.length} strategies)` };
      }
    } catch {
      // Unreadable/corrupt existing file — proceed to overwrite with valid config.
    }
  }
  // Pretty-print on disk for human readability; the canonical form is only for diffing.
  const pretty = JSON.stringify(cfg, null, 2) + "\n";
  const tmp = join(dirname(targetPath), `.${basename(targetPath)}.tmp-${process.pid}`);
  writeFileSync(tmp, pretty, "utf8");
  renameSync(tmp, targetPath); // atomic on POSIX same-filesystem
  return { status: "written", message: `wrote ${cfg.strategies.length} strategies to ${targetPath}` };
}

/** Fetch + validate + atomically write. Returns a SyncResult; never throws to caller. */
export async function syncStrategies(opts: {
  url: string;
  apiKey: string;
  targetPath: string;
  fetchImpl?: typeof fetch;
}): Promise<SyncResult> {
  const doFetch = opts.fetchImpl ?? fetch;
  try {
    const res = await doFetch(opts.url, {
      headers: { "x-bridge-api-key": opts.apiKey },
    });
    if (!res.ok) {
      return { status: "error", message: `HTTP ${res.status} — leaving existing config untouched` };
    }
    const cfg = validateEngineConfig(await res.json());
    return writeIfChanged(opts.targetPath, cfg);
  } catch (err) {
    return {
      status: "error",
      message: `${err instanceof Error ? err.message : String(err)} — leaving existing config untouched`,
    };
  }
}

// CLI entrypoint (only when run directly, not when imported by tests).
async function main() {
  const url = process.env.STRATEGIES_SYNC_URL ?? "http://localhost:3000/api/internal/strategies";
  const apiKey = process.env.BRIDGE_API_KEY ?? "";
  const targetPath = process.env.STRATEGIES_FILE ?? "/tmp/mz_strategies_fill.json";
  if (!apiKey) {
    console.error("[sync-strategies] BRIDGE_API_KEY not set");
    process.exit(2);
  }
  const result = await syncStrategies({ url, apiKey, targetPath });
  console.log(`[sync-strategies] ${result.status}: ${result.message}`);
  process.exit(result.status === "error" ? 1 : 0);
}

// Run only as a script. import.meta.url vs argv[1] guards against test import.
const invokedDirectly =
  typeof process !== "undefined" &&
  process.argv[1] &&
  import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  void main();
}

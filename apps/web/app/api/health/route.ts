import { NextResponse } from "next/server";

const QUESTDB_URL = process.env.QUESTDB_URL ?? "http://localhost:9000";
const KILL_SWITCH_URL = process.env.KILL_SWITCH_URL;
const BRIDGE_URL = process.env.BRIDGE_HTTP_URL ?? "http://localhost:3002";
const NEXTAUTH_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

async function checkService(name: string, url: string): Promise<{ name: string; status: string; latencyMs: number }> {
  const start = Date.now();
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(3000) });
    return { name, status: res.ok ? "up" : "degraded", latencyMs: Date.now() - start };
  } catch {
    return { name, status: "down", latencyMs: Date.now() - start };
  }
}

export async function GET() {
  const [questdb, killSwitch, bridge] = await Promise.all([
    checkService("questdb", `${QUESTDB_URL}/exec?query=${encodeURIComponent("SELECT 1")}`),
    // If KILL_SWITCH_URL is set, check the external C++ risk monitor HTTP endpoint.
    // Otherwise, check our own internal /api/kill-switch which manages state locally.
    KILL_SWITCH_URL
      ? checkService("kill-switch", `${KILL_SWITCH_URL}/status`)
      : checkService("kill-switch", `${NEXTAUTH_URL}/api/kill-switch`),
    checkService("bridge", `${BRIDGE_URL}/health`),
  ]);

  const services = [questdb, killSwitch, bridge];
  const allUp = services.every((s) => s.status === "up");

  return NextResponse.json({
    status: allUp ? "healthy" : "degraded",
    services,
    timestamp: new Date().toISOString(),
  });
}

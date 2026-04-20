import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { evaluateAlerts } from "@/lib/alert-evaluator";

const KILL_SWITCH_URL = process.env.KILL_SWITCH_URL;
// Feature flag controlling whether the web sends engineId in the body
// of /kill-switch/* HTTP calls to the C++ risk-monitor. Flip to "true"
// once the engine is deployed with ACCEPT_LEGACY_KILLSWITCH=1 so no
// call is ever missing tenantId thereafter.
const SEND_ENGINE_ID = process.env.ENGINE_SCHEMA_V3 === "true";

// In-memory kill switch state (until C++ risk monitor exposes an HTTP API)
let killSwitchActive = false;

// GET /api/kill-switch - proxy to C++ risk monitor or return local state
export async function GET() {
  const session = await requireAuth();
  if (isAuthError(session)) return session;

  if (KILL_SWITCH_URL) {
    try {
      const res = await fetch(`${KILL_SWITCH_URL}/status`, {
        cache: "no-store",
      });
      const data = await res.json();
      return NextResponse.json(data);
    } catch {
      // Fall through to local state
    }
  }

  return NextResponse.json({
    killSwitch: killSwitchActive,
    source: KILL_SWITCH_URL ? "fallback" : "local",
  });
}

// POST /api/kill-switch - proxy toggle to C++ risk monitor or toggle local state
export async function POST(request: NextRequest) {
  const session = await requireAuth("SUPER_ADMIN", "ADMIN", "RISK_MANAGER");
  if (isAuthError(session)) return session;

  const body = await request.json().catch(() => ({}));
  const state = body.state as "on" | "off";

  if (state !== "on" && state !== "off") {
    return NextResponse.json(
      { error: "state must be 'on' or 'off'" },
      { status: 400 }
    );
  }

  // Decide which engineId the kill applies to:
  // - SUPER_ADMIN may set tenantId=0 (global kill) or any specific tenant.
  // - ADMIN / RISK_MANAGER are forced to their own tenant regardless of
  //   what the caller supplies in the body.
  let targetEngineId: number | undefined = session.engineId;
  if (session.role === "SUPER_ADMIN" && typeof body.tenantId === "number") {
    targetEngineId = body.tenantId;
  }

  if (KILL_SWITCH_URL) {
    try {
      const proxyBody: Record<string, unknown> = {};
      if (SEND_ENGINE_ID && typeof targetEngineId === "number") {
        proxyBody.tenantId = targetEngineId;
      }
      const res = await fetch(`${KILL_SWITCH_URL}/kill-switch/${state}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proxyBody),
      });
      const data = await res.json();

      // Audit log — target tenant is the one whose trading is halted;
      // acting user may be a super-admin from a different tenant.
      const targetTenantId =
        targetEngineId === 0
          ? session.tenantId   // global kill; acting user's tenant
          : await resolveTenantUuidForEngineId(targetEngineId, session.tenantId);
      await prisma.auditLog
        .create({
          data: {
            tenantId: targetTenantId,
            userId: session.userId,
            action: state === "on" ? "KILL_SWITCH_ON" : "KILL_SWITCH_OFF",
            details: {
              actingEngineId: session.engineId,
              targetEngineId,
              actingRole: session.role,
              global: targetEngineId === 0,
            },
          },
        })
        .catch(() => {});   // Audit-log failure must not block the kill

      if (state === "on") {
        evaluateAlerts({
          type: "KILL_SWITCH",
          tenantId: targetTenantId,
          data: {
            activatedBy: session.userId,
            email: session.email,
            targetEngineId,
          },
        }).catch(() => {});
      }

      return NextResponse.json(data);
    } catch {
      // Fall through to local state
    }
  }

  killSwitchActive = state === "on";
  return NextResponse.json({
    killSwitch: killSwitchActive,
    source: KILL_SWITCH_URL ? "fallback" : "local",
  });
}

// Look up the Tenant UUID corresponding to an engineId. Used so audit
// logs are scoped to the *target* tenant even when a SUPER_ADMIN acts
// cross-tenant.
async function resolveTenantUuidForEngineId(
  engineId: number | undefined,
  fallback: string
): Promise<string> {
  if (typeof engineId !== "number") return fallback;
  const row = await prisma.tenantMapping
    .findUnique({ where: { engineId }, select: { tenantId: true } })
    .catch(() => null);
  return row?.tenantId ?? fallback;
}

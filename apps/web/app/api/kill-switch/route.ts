import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { evaluateAlerts } from "@/lib/alert-evaluator";

const KILL_SWITCH_URL = process.env.KILL_SWITCH_URL;

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
  const session = await requireAuth("SUPER_ADMIN", "ADMIN");
  if (isAuthError(session)) return session;

  const body = await request.json();
  const state = body.state as "on" | "off";

  if (state !== "on" && state !== "off") {
    return NextResponse.json(
      { error: "state must be 'on' or 'off'" },
      { status: 400 }
    );
  }

  if (KILL_SWITCH_URL) {
    try {
      const res = await fetch(`${KILL_SWITCH_URL}/kill-switch/${state}`, {
        method: "POST",
      });
      const data = await res.json();
      return NextResponse.json(data);
    } catch {
      // Fall through to local state
    }
  }

  killSwitchActive = state === "on";

  // Trigger alerts on kill switch activation
  if (state === "on") {
    evaluateAlerts({
      type: "KILL_SWITCH",
      tenantId: session.tenantId,
      data: { activatedBy: session.userId, email: session.email },
    }).catch(() => {}); // Fire and forget
  }

  return NextResponse.json({
    killSwitch: killSwitchActive,
    source: KILL_SWITCH_URL ? "fallback" : "local",
  });
}

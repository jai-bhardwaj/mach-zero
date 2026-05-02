import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { requireAuth, isAuthError } from "@/lib/require-auth";

const BINANCE_URLS = {
  testnet: "https://testnet.binance.vision",
  mainnet: "https://api.binance.com",
} as const;

// Simple in-memory rate limiter: 1 call per 5 seconds per tenant
const lastCallByTenant = new Map<string, number>();

function signQuery(queryString: string, secret: string): string {
  return createHmac("sha256", secret).update(queryString).digest("hex");
}

// POST /api/accounts/validate — test Binance API credentials
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth("SUPER_ADMIN", "ADMIN");
    if (isAuthError(session)) return session;

    const body = await request.json();
    const { apiKey, apiSecret, testnet = true } = body;

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "apiKey and apiSecret are required" },
        { status: 400 }
      );
    }

    // Rate limit
    const now = Date.now();
    const lastCall = lastCallByTenant.get(session.tenantId) ?? 0;
    if (now - lastCall < 5000) {
      return NextResponse.json(
        { error: "Please wait a few seconds before validating again" },
        { status: 429 }
      );
    }
    lastCallByTenant.set(session.tenantId, now);

    const baseUrl = testnet ? BINANCE_URLS.testnet : BINANCE_URLS.mainnet;
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = signQuery(queryString, apiSecret);
    const url = `${baseUrl}/api/v3/account?${queryString}&signature=${signature}`;

    const response = await fetch(url, {
      headers: { "X-MBX-APIKEY": apiKey },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const msg =
        (errorBody as Record<string, unknown>).msg ?? "Invalid credentials";
      return NextResponse.json({
        valid: false,
        error: String(msg),
      });
    }

    const data = (await response.json()) as {
      canTrade: boolean;
      canWithdraw: boolean;
      permissions: string[];
      balances: { asset: string; free: string; locked: string }[];
    };

    const permissions: string[] = [];
    if (data.permissions?.includes("SPOT")) permissions.push("SPOT");
    if (data.permissions?.includes("FUTURES")) permissions.push("FUTURES");

    return NextResponse.json({
      valid: true,
      canTrade: data.canTrade,
      // Surface canWithdraw to the client — Mach-Zero never withdraws,
      // so a withdraw-enabled key is purely additional risk surface for
      // the user. The UI warns prominently when this is true.
      canWithdraw: data.canWithdraw,
      permissions,
      balances: data.balances
        ?.filter(
          (b) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0
        )
        .slice(0, 20),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return NextResponse.json(
        { valid: false, error: "Connection timed out — check network or try again" },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { valid: false, error: "Validation failed" },
      { status: 500 }
    );
  }
}

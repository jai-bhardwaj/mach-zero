import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { prisma } from "@/lib/db";
import { decryptCredentials } from "@/lib/crypto";

const BINANCE_URLS = {
  testnet: "https://testnet.binance.vision",
  mainnet: "https://api.binance.com",
} as const;

// Rate limit: 1 call per 10s per account
const lastCallByAccount = new Map<string, number>();

function signQuery(queryString: string, secret: string): string {
  return createHmac("sha256", secret).update(queryString).digest("hex");
}

// GET /api/accounts/[id]/balance — fetch real balances from Binance
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    if (isAuthError(session)) return session;

    const { id } = await params;

    // Rate limit
    const now = Date.now();
    const lastCall = lastCallByAccount.get(id) ?? 0;
    if (now - lastCall < 10000) {
      return NextResponse.json(
        { error: "Please wait before fetching balances again" },
        { status: 429 }
      );
    }
    lastCallByAccount.set(id, now);

    // Fetch account with tenant isolation
    const account = await prisma.tradingAccount.findFirst({
      where: { id, tenantId: session.tenantId },
      select: {
        id: true,
        name: true,
        venue: true,
        testnet: true,
        active: true,
        config: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    if (!account.active) {
      return NextResponse.json(
        { error: "Account is inactive" },
        { status: 400 }
      );
    }

    // Only Binance is supported for now
    if (account.venue !== "Binance") {
      return NextResponse.json(
        { error: "Balance fetch only supported for Binance accounts" },
        { status: 400 }
      );
    }

    // Decrypt credentials
    const config = account.config as Record<string, unknown> | null;
    let apiKey = "";
    let apiSecret = "";

    if (config && typeof config.encryptedCredentials === "string") {
      const creds = decryptCredentials(config.encryptedCredentials);
      apiKey = creds.apiKey ?? "";
      apiSecret = creds.secretKey ?? creds.apiSecret ?? "";
    } else if (config?.credentials && typeof config.credentials === "object") {
      const creds = config.credentials as Record<string, string>;
      apiKey = creds.apiKey ?? "";
      apiSecret = creds.secretKey ?? creds.apiSecret ?? "";
    }

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "No credentials configured for this account" },
        { status: 400 }
      );
    }

    // Call Binance /api/v3/account
    const baseUrl = account.testnet
      ? BINANCE_URLS.testnet
      : BINANCE_URLS.mainnet;
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
        (errorBody as Record<string, unknown>).msg ?? "Failed to fetch balances";
      return NextResponse.json(
        { error: String(msg) },
        { status: response.status }
      );
    }

    const data = (await response.json()) as {
      balances: { asset: string; free: string; locked: string }[];
    };

    // Filter to non-zero balances, sorted by free amount descending
    const balances = (data.balances ?? [])
      .filter(
        (b) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0
      )
      .sort((a, b) => parseFloat(b.free) - parseFloat(a.free))
      .slice(0, 30);

    return NextResponse.json({
      accountId: account.id,
      accountName: account.name,
      testnet: account.testnet,
      balances,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return NextResponse.json(
        { error: "Connection timed out" },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch balances" },
      { status: 500 }
    );
  }
}

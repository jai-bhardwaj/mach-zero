import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decryptCredentials } from "@/lib/crypto";

// Internal API for the Python bridge to fetch decrypted credentials.
// Protected by BRIDGE_API_KEY shared secret (server-to-server auth).

function validateBridgeApiKey(request: NextRequest): boolean {
  const key = process.env.BRIDGE_API_KEY;
  if (!key) return false;
  const provided =
    request.headers.get("x-bridge-api-key") ??
    request.nextUrl.searchParams.get("apiKey");
  return provided === key;
}

// GET /api/internal/credentials?venue=Binance&active=true
export async function GET(request: NextRequest) {
  if (!validateBridgeApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = request.nextUrl;
    const venue = searchParams.get("venue");
    const accountId = searchParams.get("accountId");
    const activeOnly = searchParams.get("active") !== "false";

    const where: Record<string, unknown> = {};
    if (venue) where.venue = venue;
    if (accountId) where.id = accountId;
    if (activeOnly) where.active = true;

    const accounts = await prisma.tradingAccount.findMany({
      where,
      select: {
        id: true,
        name: true,
        venue: true,
        segments: true,
        testnet: true,
        config: true,
      },
    });

    const result = accounts
      .map((acct) => {
        const config = acct.config as Record<string, unknown> | null;
        let credentials: Record<string, string> = {};

        if (config && typeof config.encryptedCredentials === "string") {
          try {
            credentials = decryptCredentials(config.encryptedCredentials);
          } catch {
            // Skip accounts with invalid credentials
            return null;
          }
        } else if (
          config?.credentials &&
          typeof config.credentials === "object"
        ) {
          // Legacy unencrypted credentials
          credentials = config.credentials as Record<string, string>;
        }

        // Only return accounts that have actual credentials
        if (Object.keys(credentials).length === 0) return null;

        const baseUrl = acct.testnet
          ? "https://testnet.binance.vision"
          : "https://api.binance.com";

        return {
          id: acct.id,
          name: acct.name,
          venue: acct.venue,
          segments: acct.segments,
          testnet: acct.testnet,
          baseUrl,
          credentials,
        };
      })
      .filter(Boolean);

    // Log access for audit trail
    console.log(
      `[credentials-api] Bridge fetched ${result.length} account(s) for venue=${venue ?? "all"}`
    );

    return NextResponse.json({ accounts: result });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch credentials" },
      { status: 500 }
    );
  }
}

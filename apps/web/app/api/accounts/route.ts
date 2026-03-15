import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { VENUE_SEGMENTS, type Venue } from "@/types";

// Mask credential values — show only last 4 chars
function maskCredentials(
  config: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!config) return config;
  const masked = { ...config };
  if (
    masked.credentials &&
    typeof masked.credentials === "object" &&
    masked.credentials !== null
  ) {
    const creds = masked.credentials as Record<string, string>;
    const maskedCreds: Record<string, string> = {};
    for (const [key, value] of Object.entries(creds)) {
      if (typeof value === "string" && value.length > 4) {
        maskedCreds[key] = "••••" + value.slice(-4);
      } else if (typeof value === "string") {
        maskedCreds[key] = "••••";
      } else {
        maskedCreds[key] = value;
      }
    }
    masked.credentials = maskedCreds;
  }
  return masked;
}

// GET /api/accounts
export async function GET() {
  try {
    const session = await requireAuth();
    if (isAuthError(session)) return session;

    const where =
      session.role === "SUPER_ADMIN" ? {} : { tenantId: session.tenantId };

    const accounts = await prisma.tradingAccount.findMany({
      where,
      include: {
        tenant: { select: { name: true } },
        _count: { select: { strategies: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Mask credentials before sending to client
    const masked = accounts.map((acct) => ({
      ...acct,
      config: maskCredentials(
        acct.config as Record<string, unknown> | null
      ),
    }));

    return NextResponse.json(masked);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}

// POST /api/accounts
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth("SUPER_ADMIN", "ADMIN");
    if (isAuthError(session)) return session;

    const body = await request.json();
    const { name, venue, segments, credentials } = body;

    if (!name || !venue) {
      return NextResponse.json(
        { error: "name and venue are required" },
        { status: 400 }
      );
    }

    if (!Array.isArray(segments) || segments.length === 0) {
      return NextResponse.json(
        { error: "At least one market segment must be selected" },
        { status: 400 }
      );
    }

    // Validate segments belong to the chosen venue
    const validVenues = ["Binance", "NSE"];
    if (validVenues.includes(venue)) {
      const validSegments = VENUE_SEGMENTS[venue as Venue].map((s) => s.value);
      const invalidSegments = segments.filter(
        (s: string) => !validSegments.includes(s)
      );
      if (invalidSegments.length > 0) {
        return NextResponse.json(
          {
            error: `Invalid segments for ${venue}: ${invalidSegments.join(", ")}`,
          },
          { status: 400 }
        );
      }
    }

    // Build config
    const config: Record<string, string | Record<string, string>> = {};
    if (credentials && typeof credentials === "object") {
      config.credentials = credentials as Record<string, string>;
    }

    const account = await prisma.tradingAccount.create({
      data: {
        name,
        venue,
        segments,
        tenantId: session.tenantId,
        ...(Object.keys(config).length > 0 ? { config } : {}),
      },
    });

    return NextResponse.json(account, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}

// PUT /api/accounts
export async function PUT(request: NextRequest) {
  try {
    const session = await requireAuth("SUPER_ADMIN", "ADMIN");
    if (isAuthError(session)) return session;

    const body = await request.json();
    const { id, credentials, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.tradingAccount.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    if (
      session.role !== "SUPER_ADMIN" &&
      existing.tenantId !== session.tenantId
    ) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    // Merge credentials into config if provided
    if (credentials && typeof credentials === "object") {
      const existingConfig =
        (existing.config as Record<string, string | Record<string, string>>) ?? {};
      data.config = { ...existingConfig, credentials: credentials as Record<string, string> };
    }

    const updated = await prisma.tradingAccount.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Failed to update account" },
      { status: 500 }
    );
  }
}

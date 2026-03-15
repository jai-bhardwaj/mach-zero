import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { VENUE_SEGMENTS, type Venue } from "@/types";

const VALID_VENUES: Venue[] = ["Binance", "NSE"];

// POST /api/onboarding/account — create a trading account in the user's workspace
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (isAuthError(session)) return session;

    const body = await request.json();
    const { name, venue, segments, credentials } = body;

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json(
        { error: "Account name must be at least 2 characters" },
        { status: 400 }
      );
    }

    if (!venue || !VALID_VENUES.includes(venue)) {
      return NextResponse.json(
        { error: `Venue must be one of: ${VALID_VENUES.join(", ")}` },
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
    const validSegments = VENUE_SEGMENTS[venue as Venue].map((s) => s.value);
    const invalidSegments = segments.filter(
      (s: string) => !validSegments.includes(s)
    );
    if (invalidSegments.length > 0) {
      return NextResponse.json(
        { error: `Invalid segments for ${venue}: ${invalidSegments.join(", ")}` },
        { status: 400 }
      );
    }

    // Refresh tenantId from DB (user may have just created a workspace)
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { tenantId: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Build config with credentials (stored server-side only)
    const config: Record<string, string | Record<string, string>> = {};
    if (credentials && typeof credentials === "object") {
      config.credentials = credentials as Record<string, string>;
    }

    const account = await prisma.tradingAccount.create({
      data: {
        tenantId: user.tenantId,
        name: name.trim(),
        venue,
        segments,
        ...(Object.keys(config).length > 0 ? { config } : {}),
      },
    });

    return NextResponse.json(account, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create trading account" },
      { status: 500 }
    );
  }
}

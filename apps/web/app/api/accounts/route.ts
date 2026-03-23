import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { VENUE_SEGMENTS, type Venue } from "@/types";
import { encryptCredentials, decryptCredentials } from "@/lib/crypto";
import type { Prisma } from "@prisma/client";

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

// Decrypt encrypted credentials blob back to individual fields for masking
function decryptConfig(
  config: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!config) return config;
  const result = { ...config };
  if (typeof result.encryptedCredentials === "string") {
    try {
      result.credentials = decryptCredentials(result.encryptedCredentials);
    } catch {
      result.credentials = {};
    }
    delete result.encryptedCredentials;
  }
  return result;
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

    // Decrypt then mask credentials before sending to client
    const masked = accounts.map((acct) => ({
      ...acct,
      config: maskCredentials(
        decryptConfig(acct.config as Record<string, unknown> | null)
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
    const { name, venue, segments, credentials, testnet = true } = body;

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

    // Build config with encrypted credentials
    let config: Prisma.InputJsonValue | undefined;
    if (credentials && typeof credentials === "object") {
      const creds = credentials as Record<string, string>;
      const hasValues = Object.values(creds).some(
        (v) => typeof v === "string" && v.length > 0
      );
      if (hasValues) {
        config = { encryptedCredentials: encryptCredentials(creds) };
      }
    }

    const account = await prisma.tradingAccount.create({
      data: {
        name,
        venue,
        segments,
        testnet: Boolean(testnet),
        tenantId: session.tenantId,
        ...(config ? { config } : {}),
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
    const { id, credentials, testnet, status, statusMessage, permissions, ...data } = body;

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

    // Merge and encrypt credentials if provided
    if (credentials && typeof credentials === "object") {
      const creds = credentials as Record<string, string>;
      const hasValues = Object.values(creds).some(
        (v) => typeof v === "string" && v.length > 0
      );
      if (hasValues) {
        // Decrypt existing credentials to merge
        const existingConfig =
          (existing.config as Record<string, unknown>) ?? {};
        let existingCreds: Record<string, string> = {};
        if (typeof existingConfig.encryptedCredentials === "string") {
          try {
            existingCreds = decryptCredentials(
              existingConfig.encryptedCredentials
            );
          } catch {
            // If decryption fails, start fresh
          }
        }
        const merged = { ...existingCreds, ...creds };
        data.config = {
          ...existingConfig,
          encryptedCredentials: encryptCredentials(merged),
        };
        // Remove old plaintext credentials field if it existed
        delete (data.config as Record<string, unknown>).credentials;
      }
    }

    // Allow updating status fields
    if (status !== undefined) data.status = status;
    if (statusMessage !== undefined) data.statusMessage = statusMessage;
    if (testnet !== undefined) data.testnet = Boolean(testnet);
    if (permissions !== undefined) data.permissions = permissions;
    if (status === "connected" || status === "error") {
      data.lastCheckedAt = new Date();
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

// DELETE /api/accounts
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAuth("SUPER_ADMIN", "ADMIN");
    if (isAuthError(session)) return session;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const existing = await prisma.tradingAccount.findUnique({
      where: { id },
      include: { _count: { select: { strategies: true } } },
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

    if (existing._count.strategies > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete account with ${existing._count.strategies} attached strategies. Remove or reassign them first.`,
        },
        { status: 409 }
      );
    }

    await prisma.tradingAccount.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}

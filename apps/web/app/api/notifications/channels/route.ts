import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, isAuthError } from "@/lib/require-auth";

// GET /api/notifications/channels
export async function GET() {
  try {
    const session = await requireAuth();
    if (isAuthError(session)) return session;

    const channels = await prisma.notificationChannel.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(channels);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch channels" },
      { status: 500 }
    );
  }
}

// POST /api/notifications/channels
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth("SUPER_ADMIN", "ADMIN");
    if (isAuthError(session)) return session;

    const body = await request.json();
    const { name, type, config } = body;

    if (!name || !type) {
      return NextResponse.json(
        { error: "name and type are required" },
        { status: 400 }
      );
    }

    if (!["EMAIL", "WEBHOOK", "SLACK"].includes(type)) {
      return NextResponse.json(
        { error: "type must be EMAIL, WEBHOOK, or SLACK" },
        { status: 400 }
      );
    }

    const channel = await prisma.notificationChannel.create({
      data: {
        tenantId: session.tenantId,
        name,
        type,
        config: config ?? {},
      },
    });

    return NextResponse.json(channel, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create channel" },
      { status: 500 }
    );
  }
}

// PUT /api/notifications/channels
export async function PUT(request: NextRequest) {
  try {
    const session = await requireAuth("SUPER_ADMIN", "ADMIN");
    if (isAuthError(session)) return session;

    const body = await request.json();
    const { id, name, config, enabled } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const existing = await prisma.notificationChannel.findFirst({
      where: { id, tenantId: session.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Channel not found" },
        { status: 404 }
      );
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (config !== undefined) data.config = config;
    if (enabled !== undefined) data.enabled = enabled;

    const updated = await prisma.notificationChannel.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Failed to update channel" },
      { status: 500 }
    );
  }
}

// DELETE /api/notifications/channels?id=...
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAuth("SUPER_ADMIN", "ADMIN");
    if (isAuthError(session)) return session;

    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const existing = await prisma.notificationChannel.findFirst({
      where: { id, tenantId: session.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Channel not found" },
        { status: 404 }
      );
    }

    await prisma.notificationChannel.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete channel" },
      { status: 500 }
    );
  }
}

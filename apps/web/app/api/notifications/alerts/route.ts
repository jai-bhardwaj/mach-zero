import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, isAuthError } from "@/lib/require-auth";

const VALID_TRIGGERS = [
  "RISK_BREACH",
  "KILL_SWITCH",
  "ORDER_FILL",
  "STRATEGY_STATUS_CHANGE",
  "PNL_THRESHOLD",
  "DRAWDOWN_THRESHOLD",
];

// GET /api/notifications/alerts
export async function GET() {
  try {
    const session = await requireAuth();
    if (isAuthError(session)) return session;

    const alerts = await prisma.alert.findMany({
      where: { tenantId: session.tenantId },
      include: { channel: { select: { name: true, type: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(alerts);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch alerts" },
      { status: 500 }
    );
  }
}

// POST /api/notifications/alerts
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth("SUPER_ADMIN", "ADMIN");
    if (isAuthError(session)) return session;

    const body = await request.json();
    const { name, trigger, conditions, channelId } = body;

    if (!name || !trigger || !channelId) {
      return NextResponse.json(
        { error: "name, trigger, and channelId are required" },
        { status: 400 }
      );
    }

    if (!VALID_TRIGGERS.includes(trigger)) {
      return NextResponse.json(
        { error: `Invalid trigger. Valid: ${VALID_TRIGGERS.join(", ")}` },
        { status: 400 }
      );
    }

    // Verify channel belongs to tenant
    const channel = await prisma.notificationChannel.findFirst({
      where: { id: channelId, tenantId: session.tenantId },
    });
    if (!channel) {
      return NextResponse.json(
        { error: "Channel not found" },
        { status: 404 }
      );
    }

    const alert = await prisma.alert.create({
      data: {
        tenantId: session.tenantId,
        name,
        trigger,
        conditions: conditions ?? {},
        channelId,
      },
      include: { channel: { select: { name: true, type: true } } },
    });

    return NextResponse.json(alert, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create alert" },
      { status: 500 }
    );
  }
}

// PUT /api/notifications/alerts
export async function PUT(request: NextRequest) {
  try {
    const session = await requireAuth("SUPER_ADMIN", "ADMIN");
    if (isAuthError(session)) return session;

    const body = await request.json();
    const { id, name, conditions, channelId, enabled } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const existing = await prisma.alert.findFirst({
      where: { id, tenantId: session.tenantId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (conditions !== undefined) data.conditions = conditions;
    if (channelId !== undefined) data.channelId = channelId;
    if (enabled !== undefined) data.enabled = enabled;

    const updated = await prisma.alert.update({
      where: { id },
      data,
      include: { channel: { select: { name: true, type: true } } },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Failed to update alert" },
      { status: 500 }
    );
  }
}

// DELETE /api/notifications/alerts?id=...
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAuth("SUPER_ADMIN", "ADMIN");
    if (isAuthError(session)) return session;

    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const existing = await prisma.alert.findFirst({
      where: { id, tenantId: session.tenantId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    await prisma.alert.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete alert" },
      { status: 500 }
    );
  }
}

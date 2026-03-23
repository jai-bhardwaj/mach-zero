import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, isAuthError } from "@/lib/require-auth";

// GET /api/notifications/logs?limit=50&channelId=...&alertId=...
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (isAuthError(session)) return session;

    const { searchParams } = request.nextUrl;
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
    const channelId = searchParams.get("channelId");
    const alertId = searchParams.get("alertId");

    const where: Record<string, unknown> = { tenantId: session.tenantId };
    if (channelId) where.channelId = channelId;
    if (alertId) where.alertId = alertId;

    const logs = await prisma.notificationLog.findMany({
      where,
      include: {
        channel: { select: { name: true, type: true } },
        alert: { select: { name: true, trigger: true } },
      },
      orderBy: { sentAt: "desc" },
      take: limit,
    });

    return NextResponse.json(logs);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch notification logs" },
      { status: 500 }
    );
  }
}

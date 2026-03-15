import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, isAuthError } from "@/lib/require-auth";

// GET /api/marketplace/[id] — single template detail
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    if (isAuthError(session)) return session;

    const { id } = await params;
    const tenantId = session.tenantId;

    const template = await prisma.strategyTemplate.findUnique({
      where: { id },
      include: {
        _count: { select: { subscriptions: true } },
        subscriptions: tenantId
          ? { where: { tenantId }, select: { id: true, strategyId: true } }
          : false,
      },
    });

    if (!template || !template.active) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...template,
      isSubscribed: tenantId ? template.subscriptions.length > 0 : false,
      subscriptionStrategyId:
        tenantId && template.subscriptions.length > 0
          ? template.subscriptions[0].strategyId
          : null,
      subscriptions: undefined,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch template" },
      { status: 500 }
    );
  }
}

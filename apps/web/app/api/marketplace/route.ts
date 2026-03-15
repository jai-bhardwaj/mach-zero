import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, isAuthError } from "@/lib/require-auth";

// GET /api/marketplace — list active strategy templates
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (isAuthError(session)) return session;

    const tenantId = session.tenantId;

    const category = request.nextUrl.searchParams.get("category");
    const riskLevel = request.nextUrl.searchParams.get("riskLevel");
    const featured = request.nextUrl.searchParams.get("featured");

    const where: Record<string, unknown> = { active: true };
    if (category) where.category = category;
    if (riskLevel) where.riskLevel = riskLevel;
    if (featured === "true") where.featured = true;

    const templates = await prisma.strategyTemplate.findMany({
      where,
      include: {
        _count: { select: { subscriptions: true } },
        subscriptions: tenantId
          ? { where: { tenantId }, select: { id: true, strategyId: true } }
          : false,
      },
      orderBy: [{ featured: "desc" }, { returnPct: "desc" }],
    });

    const result = templates.map((t) => ({
      ...t,
      isSubscribed: tenantId ? t.subscriptions.length > 0 : false,
      subscriptionStrategyId:
        tenantId && t.subscriptions.length > 0
          ? t.subscriptions[0].strategyId
          : null,
      subscriptions: undefined,
    }));

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch marketplace templates" },
      { status: 500 }
    );
  }
}

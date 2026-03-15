import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, isAuthError } from "@/lib/require-auth";

// GET /api/trading-mode — returns aggregate strategy mode counts
export async function GET() {
  try {
    const session = await requireAuth();
    if (isAuthError(session)) return session;

    const modeCounts = await prisma.strategyConfig.groupBy({
      by: ["tradingMode"],
      _count: true,
      where: { tenantId: session.tenantId },
    });

    const mockCount =
      modeCounts.find((m) => m.tradingMode === "MOCK")?._count ?? 0;
    const liveCount =
      modeCounts.find((m) => m.tradingMode === "LIVE")?._count ?? 0;

    return NextResponse.json({
      mockCount,
      liveCount,
      hasLiveStrategies: liveCount > 0,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch trading mode" },
      { status: 500 }
    );
  }
}

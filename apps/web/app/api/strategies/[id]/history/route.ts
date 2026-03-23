import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, isAuthError } from "@/lib/require-auth";

// GET /api/strategies/[id]/history — list version history for a strategy
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    if (isAuthError(session)) return session;

    const { id } = await params;

    // Verify strategy exists and belongs to tenant
    const strategy = await prisma.strategyConfig.findFirst({
      where:
        session.role === "SUPER_ADMIN"
          ? { id }
          : { id, tenantId: session.tenantId },
      select: { id: true, name: true, configVersion: true },
    });

    if (!strategy) {
      return NextResponse.json(
        { error: "Strategy not found" },
        { status: 404 }
      );
    }

    const history = await prisma.strategyConfigHistory.findMany({
      where: { strategyId: id },
      orderBy: { configVersion: "desc" },
    });

    return NextResponse.json({
      strategyId: strategy.id,
      strategyName: strategy.name,
      currentVersion: strategy.configVersion,
      history,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch strategy history" },
      { status: 500 }
    );
  }
}

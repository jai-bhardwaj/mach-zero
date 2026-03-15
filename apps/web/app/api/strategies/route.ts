import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, isAuthError } from "@/lib/require-auth";

// Valid status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["RUNNING"],
  RUNNING: ["PAUSED", "STOPPED"],
  PAUSED: ["RUNNING", "STOPPED"],
  STOPPED: ["RUNNING"],
};

// GET /api/strategies
export async function GET() {
  try {
    const session = await requireAuth();
    if (isAuthError(session)) return session;

    const where =
      session.role === "SUPER_ADMIN" ? {} : { tenantId: session.tenantId };

    const strategies = await prisma.strategyConfig.findMany({
      where,
      include: {
        allocation: true,
        account: { select: { name: true, venue: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(strategies);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch strategies" },
      { status: 500 }
    );
  }
}

// POST /api/strategies - create new strategy
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth("SUPER_ADMIN", "ADMIN", "TRADER");
    if (isAuthError(session)) return session;

    const body = await request.json();
    const {
      accountId,
      name,
      type,
      symbolId,
      symbolName,
      venue,
      params,
      maxPositionLimit,
      maxOrderRate,
      maxDrawdown,
      riskMultiplier,
    } = body;

    if (!name || !type || !symbolId || !symbolName || !venue) {
      return NextResponse.json(
        {
          error:
            "name, type, symbolId, symbolName, and venue are required",
        },
        { status: 400 }
      );
    }

    const strategy = await prisma.strategyConfig.create({
      data: {
        tenantId: session.tenantId,
        accountId,
        name,
        type,
        symbolId,
        symbolName,
        venue,
        params: params ?? {},
        status: "PENDING",
        tradingMode: "MOCK",
        maxPositionLimit,
        maxOrderRate,
        maxDrawdown,
        riskMultiplier: riskMultiplier ?? 1.0,
      },
      include: { allocation: true },
    });

    return NextResponse.json(strategy, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create strategy" },
      { status: 500 }
    );
  }
}

// PUT /api/strategies - update strategy (params, status, risk limits, tradingMode)
export async function PUT(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (isAuthError(session)) return session;

    const body = await request.json();
    const {
      id,
      status,
      tradingMode,
      params,
      maxPositionLimit,
      maxOrderRate,
      maxDrawdown,
      riskMultiplier,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const current = await prisma.strategyConfig.findUnique({
      where: { id },
      include: { allocation: true },
    });

    if (!current) {
      return NextResponse.json(
        { error: "Strategy not found" },
        { status: 404 }
      );
    }

    // Tenant isolation: verify ownership
    if (
      session.role !== "SUPER_ADMIN" &&
      current.tenantId !== session.tenantId
    ) {
      return NextResponse.json(
        { error: "Strategy not found" },
        { status: 404 }
      );
    }

    // Handle trading mode change
    if (tradingMode && tradingMode !== current.tradingMode) {
      if (tradingMode === "LIVE" && !body.liveConfirm) {
        return NextResponse.json(
          {
            error: "LIVE_MODE_CONFIRMATION_REQUIRED",
            message:
              "Switching this strategy to LIVE mode will execute real orders. Confirm to proceed.",
            tradingMode: "LIVE",
          },
          { status: 428 }
        );
      }
    }

    // If status transition, validate it
    if (status) {
      const allowed = VALID_TRANSITIONS[current.status] ?? [];
      if (!allowed.includes(status)) {
        return NextResponse.json(
          {
            error: `Cannot transition from ${current.status} to ${status}. Allowed: ${allowed.join(", ") || "none"}`,
          },
          { status: 400 }
        );
      }

      // Determine effective mode (use new mode if being changed, otherwise current)
      const effectiveMode = tradingMode ?? current.tradingMode;

      // PENDING → RUNNING requires capital allocation only for LIVE strategies
      if (
        current.status === "PENDING" &&
        status === "RUNNING" &&
        effectiveMode === "LIVE" &&
        !current.allocation
      ) {
        return NextResponse.json(
          { error: "Cannot start LIVE strategy without capital allocation" },
          { status: 400 }
        );
      }

      // Starting/resuming in LIVE mode requires explicit confirmation
      if (status === "RUNNING" && effectiveMode === "LIVE" && !body.liveConfirm) {
        return NextResponse.json(
          {
            error: "LIVE_MODE_CONFIRMATION_REQUIRED",
            message:
              "Starting a strategy in LIVE mode will execute real orders. Confirm to proceed.",
            tradingMode: "LIVE",
          },
          { status: 428 }
        );
      }
    }

    const data: Record<string, unknown> = {};
    if (status !== undefined) data.status = status;
    if (params !== undefined) data.params = params;
    if (maxPositionLimit !== undefined) data.maxPositionLimit = maxPositionLimit;
    if (maxOrderRate !== undefined) data.maxOrderRate = maxOrderRate;
    if (maxDrawdown !== undefined) data.maxDrawdown = maxDrawdown;
    if (riskMultiplier !== undefined) data.riskMultiplier = riskMultiplier;
    if (tradingMode !== undefined) {
      data.tradingMode = tradingMode;
      data.modeChangedAt = new Date();
    }

    const updated = await prisma.strategyConfig.update({
      where: { id },
      data,
      include: { allocation: true },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Failed to update strategy" },
      { status: 500 }
    );
  }
}

// DELETE /api/strategies?id=...
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (isAuthError(session)) return session;

    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const strategy = await prisma.strategyConfig.findUnique({
      where: { id },
      include: { allocation: true },
    });

    if (!strategy) {
      return NextResponse.json(
        { error: "Strategy not found" },
        { status: 404 }
      );
    }

    // Tenant isolation: verify ownership
    if (
      session.role !== "SUPER_ADMIN" &&
      strategy.tenantId !== session.tenantId
    ) {
      return NextResponse.json(
        { error: "Strategy not found" },
        { status: 404 }
      );
    }

    if (strategy.status !== "STOPPED" && strategy.status !== "PENDING") {
      return NextResponse.json(
        { error: "Can only delete STOPPED or PENDING strategies" },
        { status: 400 }
      );
    }

    // Delete allocation first if exists, then strategy
    await prisma.$transaction([
      ...(strategy.allocation
        ? [prisma.capitalAllocation.delete({ where: { strategyId: id } })]
        : []),
      prisma.strategyConfig.delete({ where: { id } }),
    ]);

    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete strategy" },
      { status: 500 }
    );
  }
}

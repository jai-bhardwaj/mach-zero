import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, isAuthError } from "@/lib/require-auth";

// GET /api/capital - list capital pools with allocations
export async function GET() {
  try {
    const session = await requireAuth();
    if (isAuthError(session)) return session;

    const where =
      session.role === "SUPER_ADMIN" ? {} : { tenantId: session.tenantId };

    const pools = await prisma.capitalPool.findMany({
      where,
      include: {
        account: { select: { name: true, venue: true } },
        allocations: {
          include: {
            strategy: { select: { name: true, symbolName: true, status: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(pools);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch capital pools" },
      { status: 500 }
    );
  }
}

// POST /api/capital - create or update a capital pool
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth("SUPER_ADMIN", "ADMIN");
    if (isAuthError(session)) return session;

    const body = await request.json();
    const { accountId, totalCapital, currency } = body;

    if (!accountId || totalCapital === undefined) {
      return NextResponse.json(
        { error: "accountId and totalCapital are required" },
        { status: 400 }
      );
    }

    const pool = await prisma.capitalPool.upsert({
      where: {
        tenantId_accountId: {
          tenantId: session.tenantId,
          accountId,
        },
      },
      update: { totalCapital, currency: currency ?? "USD" },
      create: {
        tenantId: session.tenantId,
        accountId,
        totalCapital,
        currency: currency ?? "USD",
      },
      include: {
        account: { select: { name: true, venue: true } },
        allocations: true,
      },
    });

    return NextResponse.json(pool);
  } catch {
    return NextResponse.json(
      { error: "Failed to save capital pool" },
      { status: 500 }
    );
  }
}

// PUT /api/capital - allocate capital to a strategy
export async function PUT(request: NextRequest) {
  try {
    const session = await requireAuth("SUPER_ADMIN", "ADMIN");
    if (isAuthError(session)) return session;

    const body = await request.json();
    const { poolId, strategyId, allocatedAmt, maxDrawdown } = body;

    if (!poolId || !strategyId || allocatedAmt === undefined) {
      return NextResponse.json(
        { error: "poolId, strategyId, and allocatedAmt are required" },
        { status: 400 }
      );
    }

    if (typeof allocatedAmt !== "number" || !Number.isFinite(allocatedAmt) || allocatedAmt < 0) {
      return NextResponse.json(
        { error: "allocatedAmt must be a non-negative number" },
        { status: 400 }
      );
    }

    // Get the pool and existing allocation
    const pool = await prisma.capitalPool.findUnique({
      where: { id: poolId },
      include: { allocations: true },
    });

    if (!pool) {
      return NextResponse.json({ error: "Pool not found" }, { status: 404 });
    }

    // Tenant isolation
    if (
      session.role !== "SUPER_ADMIN" &&
      pool.tenantId !== session.tenantId
    ) {
      return NextResponse.json({ error: "Pool not found" }, { status: 404 });
    }

    // Calculate available capital
    const existingAllocation = pool.allocations.find(
      (a) => a.strategyId === strategyId
    );
    const currentAllocationAmt = existingAllocation?.allocatedAmt ?? 0;
    const available =
      pool.totalCapital - pool.allocatedTotal + currentAllocationAmt;

    if (allocatedAmt > available) {
      return NextResponse.json(
        {
          error: `Insufficient capital. Available: ${available}, Requested: ${allocatedAmt}`,
        },
        { status: 400 }
      );
    }

    // Upsert allocation and update pool total
    const newAllocatedTotal =
      pool.allocatedTotal - currentAllocationAmt + allocatedAmt;

    const [allocation] = await prisma.$transaction([
      prisma.capitalAllocation.upsert({
        where: { strategyId },
        update: { allocatedAmt, maxDrawdown, poolId },
        create: { poolId, strategyId, allocatedAmt, maxDrawdown },
      }),
      prisma.capitalPool.update({
        where: { id: poolId },
        data: { allocatedTotal: newAllocatedTotal },
      }),
    ]);

    return NextResponse.json(allocation);
  } catch {
    return NextResponse.json(
      { error: "Failed to allocate capital" },
      { status: 500 }
    );
  }
}

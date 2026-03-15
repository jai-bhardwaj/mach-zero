import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, isAuthError } from "@/lib/require-auth";

// GET /api/tenants
export async function GET() {
  try {
    const session = await requireAuth();
    if (isAuthError(session)) return session;

    const where =
      session.role === "SUPER_ADMIN" ? {} : { id: session.tenantId };

    const tenants = await prisma.tenant.findMany({
      where,
      include: {
        _count: { select: { users: true, strategies: true, accounts: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(tenants);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch tenants" },
      { status: 500 }
    );
  }
}

// POST /api/tenants
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth("SUPER_ADMIN");
    if (isAuthError(session)) return session;

    const body = await request.json();
    const { name, slug, config } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: "name and slug are required" },
        { status: 400 }
      );
    }

    const tenant = await prisma.tenant.create({
      data: { name, slug, config },
    });

    return NextResponse.json(tenant, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create tenant" },
      { status: 500 }
    );
  }
}

// PUT /api/tenants
export async function PUT(request: NextRequest) {
  try {
    const session = await requireAuth("SUPER_ADMIN", "ADMIN");
    if (isAuthError(session)) return session;

    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // ADMIN can only update their own tenant
    if (session.role !== "SUPER_ADMIN" && id !== session.tenantId) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const updated = await prisma.tenant.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Failed to update tenant" },
      { status: 500 }
    );
  }
}

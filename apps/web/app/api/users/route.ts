import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, isAuthError } from "@/lib/require-auth";

// GET /api/users
export async function GET() {
  try {
    const session = await requireAuth();
    if (isAuthError(session)) return session;

    const where =
      session.role === "SUPER_ADMIN" ? {} : { tenantId: session.tenantId };

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        tenantId: true,
        username: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
        tenant: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(users);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

// POST /api/users - invite/create user (OAuth — no password needed)
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth("SUPER_ADMIN", "ADMIN");
    if (isAuthError(session)) return session;

    const body = await request.json();
    const { username, email, role, tenantId } = body;

    if (!username || !email) {
      return NextResponse.json(
        { error: "username and email are required" },
        { status: 400 }
      );
    }

    // SUPER_ADMIN can specify tenantId, others use their own
    const effectiveTenantId =
      session.role === "SUPER_ADMIN" && tenantId
        ? tenantId
        : session.tenantId;

    // Prevent role escalation: ADMIN cannot create SUPER_ADMIN
    if (role === "SUPER_ADMIN" && session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Cannot create SUPER_ADMIN users" },
        { status: 403 }
      );
    }

    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: "",
        role: role ?? "VIEWER",
        tenantId: effectiveTenantId,
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        tenantId: true,
        active: true,
        createdAt: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}

// PUT /api/users - update user (role, active status, username)
export async function PUT(request: NextRequest) {
  try {
    const session = await requireAuth("SUPER_ADMIN", "ADMIN");
    if (isAuthError(session)) return session;

    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Verify user belongs to tenant
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (
      session.role !== "SUPER_ADMIN" &&
      existing.tenantId !== session.tenantId
    ) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevent role escalation
    if (data.role === "SUPER_ADMIN" && session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Cannot assign SUPER_ADMIN role" },
        { status: 403 }
      );
    }

    // Remove password from update data (auth is OAuth-based)
    delete data.password;

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        active: true,
      },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}

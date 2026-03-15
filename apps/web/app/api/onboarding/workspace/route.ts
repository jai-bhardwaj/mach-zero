import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, isAuthError } from "@/lib/require-auth";

// POST /api/onboarding/workspace — create a new workspace and move user into it as ADMIN
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (isAuthError(session)) return session;

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length < 2 || name.trim().length > 50) {
      return NextResponse.json(
        { error: "Workspace name must be 2-50 characters" },
        { status: 400 }
      );
    }

    const trimmed = name.trim();

    // Generate slug from name
    let slug = trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Ensure slug uniqueness
    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    // Check name uniqueness
    const nameExists = await prisma.tenant.findUnique({ where: { name: trimmed } });
    if (nameExists) {
      return NextResponse.json(
        { error: "A workspace with that name already exists" },
        { status: 409 }
      );
    }

    // Create workspace and move user into it as ADMIN
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: trimmed, slug },
      });

      await tx.user.update({
        where: { id: session.userId },
        data: { tenantId: tenant.id, role: "ADMIN" },
      });

      return tenant;
    });

    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create workspace" },
      { status: 500 }
    );
  }
}

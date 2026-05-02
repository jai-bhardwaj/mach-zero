import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { evaluateGeoblock } from "@/lib/sanctions";
import { track } from "@/lib/analytics";

// POST /api/onboarding/workspace — create a new workspace and move user into it as ADMIN
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (isAuthError(session)) return session;

    // Geo-block sanctioned jurisdictions before we let a user create
    // their first workspace. Returning 451 (Unavailable For Legal
    // Reasons) is RFC-7725 idiomatic for this case and gives the
    // frontend a specific status to render a clear message against.
    const geo = evaluateGeoblock(request);
    if (!geo.ok) {
      return NextResponse.json(
        {
          error:
            geo.reason === "sanctioned"
              ? "Mach-Zero is not available in your region for legal reasons."
              : "We could not verify your location. Try again, or contact support if this persists.",
          reason: geo.reason,
          country: geo.country,
        },
        { status: geo.reason === "sanctioned" ? 451 : 503 }
      );
    }

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

    // Create workspace + engine mapping + move user into it as ADMIN.
    // The TenantMapping allocation must be atomic with Tenant creation
    // so we never end up with a tenant that can't address the engine.
    // Seed also enforces engineId < MAX_TENANTS (1024) at boot, but a
    // runtime check here keeps the failure mode clean.
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: trimmed, slug },
      });

      const mapping = await tx.tenantMapping.create({
        data: { tenantId: tenant.id },
      });

      if (mapping.engineId >= 1024) {
        throw new Error(
          `engineId=${mapping.engineId} >= MAX_TENANTS. Engine needs MAX_TENANTS bump before more tenants can be onboarded.`
        );
      }

      await tx.user.update({
        where: { id: session.userId },
        data: { tenantId: tenant.id, role: "ADMIN" },
      });

      return { tenant, engineId: mapping.engineId };
    });

    track({
      userId: session.userId,
      event: "workspace_created",
      engineId: result.engineId,
      tenantId: result.tenant.id,
      tenantName: result.tenant.name,
      role: "ADMIN",
      properties: { country: geo.country },
    });

    return NextResponse.json(result.tenant, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create workspace" },
      { status: 500 }
    );
  }
}

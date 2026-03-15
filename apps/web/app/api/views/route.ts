import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, isAuthError } from "@/lib/require-auth";

const VALID_TABLE_IDS = ["trades", "orders", "risk_events", "risk-events", "positions", "users"];

// GET /api/views?tableId=...
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (isAuthError(session)) return session;

    const tableId = request.nextUrl.searchParams.get("tableId");
    if (!tableId || !VALID_TABLE_IDS.includes(tableId)) {
      return NextResponse.json(
        { error: "Valid tableId is required" },
        { status: 400 }
      );
    }

    const views = await prisma.savedTableView.findMany({
      where: {
        userId: session.userId,
        tenantId: session.tenantId,
        tableId,
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ data: views });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch views" },
      { status: 500 }
    );
  }
}

// POST /api/views - create new view
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (isAuthError(session)) return session;

    const body = await request.json();
    const { name, tableId, config, isDefault } = body;

    if (!name || !tableId || !config) {
      return NextResponse.json(
        { error: "name, tableId, and config are required" },
        { status: 400 }
      );
    }

    if (!VALID_TABLE_IDS.includes(tableId)) {
      return NextResponse.json(
        { error: "Invalid tableId" },
        { status: 400 }
      );
    }

    const view = await prisma.$transaction(async (tx) => {
      // If setting as default, clear existing defaults for this table
      if (isDefault) {
        await tx.savedTableView.updateMany({
          where: {
            userId: session.userId,
            tenantId: session.tenantId,
            tableId,
            isDefault: true,
          },
          data: { isDefault: false },
        });
      }

      return tx.savedTableView.create({
        data: {
          tenantId: session.tenantId,
          userId: session.userId,
          name,
          tableId,
          config,
          isDefault: isDefault ?? false,
        },
      });
    });

    return NextResponse.json({ data: view }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create view" },
      { status: 500 }
    );
  }
}

// PUT /api/views - update view
export async function PUT(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (isAuthError(session)) return session;

    const body = await request.json();
    const { id, name, config, isDefault } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.savedTableView.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "View not found" },
        { status: 404 }
      );
    }

    if (existing.userId !== session.userId) {
      return NextResponse.json(
        { error: "View not found" },
        { status: 404 }
      );
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (config !== undefined) data.config = config;
    if (isDefault !== undefined) data.isDefault = isDefault;

    const updated = await prisma.$transaction(async (tx) => {
      // If setting as default, clear existing defaults for this table
      if (isDefault) {
        await tx.savedTableView.updateMany({
          where: {
            userId: session.userId,
            tenantId: session.tenantId,
            tableId: existing.tableId,
            isDefault: true,
            id: { not: id },
          },
          data: { isDefault: false },
        });
      }

      return tx.savedTableView.update({
        where: { id },
        data,
      });
    });

    return NextResponse.json({ data: updated });
  } catch {
    return NextResponse.json(
      { error: "Failed to update view" },
      { status: 500 }
    );
  }
}

// DELETE /api/views - delete view
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (isAuthError(session)) return session;

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.savedTableView.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "View not found" },
        { status: 404 }
      );
    }

    if (existing.userId !== session.userId) {
      return NextResponse.json(
        { error: "View not found" },
        { status: 404 }
      );
    }

    await prisma.savedTableView.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete view" },
      { status: 500 }
    );
  }
}

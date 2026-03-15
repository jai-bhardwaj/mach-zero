import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { SYMBOL_MAP } from "@/types";

// POST /api/marketplace/subscribe — subscribe to a strategy template
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth("SUPER_ADMIN", "ADMIN", "TRADER");
    if (isAuthError(session)) return session;

    const tenantId = session.tenantId;
    const userId = session.userId;

    const body = await request.json();
    const { templateId, accountId, symbolId } = body;

    if (!templateId || !accountId) {
      return NextResponse.json(
        { error: "templateId and accountId are required" },
        { status: 400 }
      );
    }

    const template = await prisma.strategyTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template || !template.active) {
      return NextResponse.json(
        { error: "Template not found or inactive" },
        { status: 404 }
      );
    }

    const existing = await prisma.strategySubscription.findUnique({
      where: { tenantId_templateId: { tenantId, templateId } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Already subscribed to this template" },
        { status: 409 }
      );
    }

    const account = await prisma.tradingAccount.findFirst({
      where: { id: accountId, tenantId },
    });
    if (!account) {
      return NextResponse.json(
        { error: "Trading account not found" },
        { status: 404 }
      );
    }

    const selectedSymbolId = symbolId ?? template.symbolIds[0];
    if (!template.symbolIds.includes(selectedSymbolId)) {
      return NextResponse.json(
        { error: "Symbol not supported by this template" },
        { status: 400 }
      );
    }

    const symbolInfo = SYMBOL_MAP[selectedSymbolId];
    const strategyName = `${template.slug}-${account.name.toLowerCase().replace(/\s+/g, "-")}-${Date.now().toString(36)}`;

    const result = await prisma.$transaction(async (tx) => {
      const strategyConfig = await tx.strategyConfig.create({
        data: {
          tenantId,
          accountId,
          name: strategyName,
          type: template.type,
          symbolId: selectedSymbolId,
          symbolName: symbolInfo?.name ?? `SYM-${selectedSymbolId}`,
          venue: symbolInfo?.venue ?? account.venue,
          status: "RUNNING",
          tradingMode: "MOCK",
          params: (template.params ?? {}) as object,
          maxDrawdown: template.maxDrawdownPct
            ? template.minCapital * (template.maxDrawdownPct / 100)
            : null,
          riskMultiplier: 1.0,
        },
      });

      const subscription = await tx.strategySubscription.create({
        data: {
          tenantId,
          templateId,
          strategyId: strategyConfig.id,
          subscribedBy: userId,
        },
      });

      return { strategyConfig, subscription };
    });

    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to subscribe" },
      { status: 500 }
    );
  }
}

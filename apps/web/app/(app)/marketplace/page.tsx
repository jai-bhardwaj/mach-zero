import { prisma } from "@/lib/db";
import { requirePageAuth } from "@/lib/require-auth";
import type { StrategyTemplate } from "@/types";
import { MarketplaceClient } from "@/components/marketplace/MarketplaceClient";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Marketplace | Mach-Zero" };
export default async function MarketplacePage() {
  await requirePageAuth();

  const [templates, accounts] = await Promise.all([
    prisma.strategyTemplate.findMany({
      include: {
        _count: { select: { subscriptions: true } },
      },
      orderBy: [{ featured: "desc" }, { returnPct: "desc" }],
    }),
    prisma.tradingAccount.findMany({
      select: { id: true, name: true, venue: true },
    }),
  ]);

  // Serialize to plain objects for the client component
  const serializedTemplates: StrategyTemplate[] = templates.map((t) => {
    // Destructure Prisma-specific fields and re-serialize for the client
    const { _count, createdAt, updatedAt, params, ...rest } = t;
    return {
      ...rest,
      params: (params ?? {}) as Record<string, number>,
      subscriberCount: _count.subscriptions,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    };
  });

  const serializedAccounts = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    venue: a.venue,
  }));

  return (
    <div className="space-y-6">
      {/* Header — server-rendered, zero JS */}
      <PageHeader title="Strategy Marketplace" description="Browse and deploy proven trading strategies" />

      {/* Interactive client leaf */}
      <MarketplaceClient
        initialTemplates={serializedTemplates}
        accounts={serializedAccounts}
      />
    </div>
  );
}

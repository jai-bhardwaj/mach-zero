import { prisma } from "@/lib/db";
import { requirePageAuth } from "@/lib/require-auth";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { PageHeader } from "@/components/ui/page-header";

export default async function DashboardPage() {
  const session = await requirePageAuth();

  const [accountCount, strategyCount] = await Promise.all([
    prisma.tradingAccount.count({ where: { tenantId: session.tenantId } }),
    prisma.strategyConfig.count({ where: { tenantId: session.tenantId } }),
  ]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="Dashboard" />
      <DashboardClient
        hasAccounts={accountCount > 0}
        hasStrategies={strategyCount > 0}
      />
    </div>
  );
}

import { prisma } from "@/lib/db";
import { requirePageAuth } from "@/lib/require-auth";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { PageHeader } from "@/components/ui/page-header";

export default async function DashboardPage() {
  const session = await requirePageAuth();

  let hasAccounts = false;
  let hasStrategies = false;

  if (session.tenantId) {
    const [accountCount, strategyCount] = await Promise.all([
      prisma.tradingAccount.count({ where: { tenantId: session.tenantId } }),
      prisma.strategyConfig.count({ where: { tenantId: session.tenantId } }),
    ]);
    hasAccounts = accountCount > 0;
    hasStrategies = strategyCount > 0;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="Dashboard" />
      <DashboardClient
        hasAccounts={hasAccounts}
        hasStrategies={hasStrategies}
      />
    </div>
  );
}

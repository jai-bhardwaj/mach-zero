import { prisma } from "@/lib/db";
import { requirePageAuth } from "@/lib/require-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Tenants | Mach-Zero" };

export default async function TenantsPage() {
  const session = await requirePageAuth();

  const where =
    session.role === "SUPER_ADMIN" ? {} : { id: session.tenantId };

  const tenants = await prisma.tenant.findMany({
    where,
    include: {
      _count: { select: { users: true, strategies: true, accounts: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold tracking-tight">Tenants</h1>
      {tenants.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No tenants configured.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {tenants.map((t) => (
            <Card key={t.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">{t.name}</h3>
                  <Badge variant={t.active ? "running" : "stopped"}>
                    {t.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">/{t.slug}</div>
                <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                  <span>{t._count.users} users</span>
                  <span>{t._count.strategies} strategies</span>
                  <span>{t._count.accounts} accounts</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

import { prisma } from "@/lib/db";
import { requirePageAuth } from "@/lib/require-auth";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

export default async function WorkspacesPage() {
  const session = await requirePageAuth();

  const where =
    session.role === "SUPER_ADMIN" ? {} : { id: session.tenantId };

  const workspaces = await prisma.tenant.findMany({
    where,
    include: {
      _count: { select: { users: true, strategies: true, accounts: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Workspaces" />
      {workspaces.length === 0 ? (
        <p className="py-8 text-center text-xs text-muted-foreground">
          No workspaces configured.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {workspaces.map((w) => (
            <div
              key={w.id}
              className="rounded-lg border border-border/50 p-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">{w.name}</h3>
                <span className="inline-flex items-center gap-1.5 text-xs">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      w.active ? "bg-green-400" : "bg-zinc-400"
                    )}
                  />
                  {w.active ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">/{w.slug}</div>
              <div className="flex gap-4 text-[11px] text-muted-foreground">
                <span>{w._count.users} users</span>
                <span>{w._count.strategies} strategies</span>
                <span>{w._count.accounts} accounts</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

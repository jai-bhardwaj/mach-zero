import { prisma } from "@/lib/db";
import { requirePageAuth } from "@/lib/require-auth";
import { SEGMENT_LABELS } from "@/types";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

export default async function AccountsPage() {
  const session = await requirePageAuth();

  const where =
    session.role === "SUPER_ADMIN" ? {} : { tenantId: session.tenantId };

  const accounts = await prisma.tradingAccount.findMany({
    where,
    include: {
      tenant: { select: { name: true } },
      _count: { select: { strategies: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Check if credentials are configured (without exposing them)
  function hasCredentials(config: unknown): boolean {
    if (!config || typeof config !== "object") return false;
    const c = config as Record<string, unknown>;
    if (!c.credentials || typeof c.credentials !== "object") return false;
    const creds = c.credentials as Record<string, string>;
    return Object.values(creds).some((v) => typeof v === "string" && v.length > 0);
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="Trading Accounts" />
      {accounts.length === 0 ? (
        <p className="py-8 text-center text-xs text-muted-foreground">
          No trading accounts configured.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {accounts.map((acct) => {
            const connected = hasCredentials(acct.config);

            return (
              <div
                key={acct.id}
                className="rounded-lg border border-border/50 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">{acct.name}</h3>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      {acct.venue}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        acct.active ? "bg-green-400" : "bg-zinc-400"
                      )}
                    />
                    {acct.active ? "Active" : "Inactive"}
                  </span>
                </div>

                {/* Segments */}
                <div className="flex flex-wrap gap-1.5">
                  {acct.segments.length === 0 ? (
                    <span className="text-[11px] text-muted-foreground italic">
                      No segments configured
                    </span>
                  ) : (
                    acct.segments.map((seg) => (
                      <span
                        key={seg}
                        className="rounded-md border border-border/50 px-2 py-0.5 text-[11px] text-muted-foreground"
                      >
                        {SEGMENT_LABELS[seg] ?? seg}
                      </span>
                    ))
                  )}
                </div>

                {/* Connection status + strategy count */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        connected ? "bg-green-400" : "bg-yellow-400"
                      )}
                    />
                    {connected ? "Credentials configured" : "No credentials"}
                  </div>
                  {acct._count.strategies > 0 && (
                    <span>{acct._count.strategies} strategies</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

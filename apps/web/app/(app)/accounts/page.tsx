import { prisma } from "@/lib/db";
import { requirePageAuth } from "@/lib/require-auth";
import { PageHeader } from "@/components/ui/page-header";
import { AccountsClient } from "@/components/accounts/AccountsClient";
import { decryptCredentials } from "@/lib/crypto";
import type { TradingAccountWithRelations, AccountStatus } from "@/types";

// Mask credential values for client display
function maskConfig(
  config: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!config) return config;
  const result = { ...config };

  // Decrypt encrypted credentials for masking
  if (typeof result.encryptedCredentials === "string") {
    try {
      const creds = decryptCredentials(result.encryptedCredentials);
      const masked: Record<string, string> = {};
      for (const [key, value] of Object.entries(creds)) {
        if (typeof value === "string" && value.length > 4) {
          masked[key] = "••••" + value.slice(-4);
        } else {
          masked[key] = "••••";
        }
      }
      result.credentials = masked;
    } catch {
      result.credentials = {};
    }
    delete result.encryptedCredentials;
  } else if (
    result.credentials &&
    typeof result.credentials === "object"
  ) {
    // Legacy unencrypted credentials — mask them too
    const creds = result.credentials as Record<string, string>;
    const masked: Record<string, string> = {};
    for (const [key, value] of Object.entries(creds)) {
      if (typeof value === "string" && value.length > 4) {
        masked[key] = "••••" + value.slice(-4);
      } else if (typeof value === "string") {
        masked[key] = "••••";
      } else {
        masked[key] = value;
      }
    }
    result.credentials = masked;
  }

  return result;
}

export const metadata = { title: "Accounts | Mach-Zero" };
export default async function AccountsPage() {
  const session = await requirePageAuth();

  const where =
    session.role === "SUPER_ADMIN" ? {} : { tenantId: session.tenantId };

  let accounts: Awaited<ReturnType<typeof prisma.tradingAccount.findMany<{
    where: typeof where;
    include: { tenant: { select: { name: true } }; _count: { select: { strategies: true } } };
    orderBy: { createdAt: "desc" };
  }>>>;
  try {
    accounts = await prisma.tradingAccount.findMany({
      where,
      include: {
        tenant: { select: { name: true } },
        _count: { select: { strategies: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    accounts = [];
  }

  // Serialize for client: mask credentials, cast types
  const serialized: TradingAccountWithRelations[] = accounts.map((acct) => {
    let maskedConfig: Record<string, unknown> | null = null;
    try {
      maskedConfig = maskConfig(acct.config as Record<string, unknown> | null);
    } catch {
      // If decryption fails (missing key), show empty credentials
      maskedConfig = { credentials: {} };
    }

    return {
      id: acct.id,
      tenantId: acct.tenantId,
      name: acct.name,
      venue: acct.venue,
      segments: acct.segments,
      active: acct.active,
      config: maskedConfig,
      status: acct.status as AccountStatus,
      statusMessage: acct.statusMessage,
      testnet: acct.testnet,
      lastCheckedAt: acct.lastCheckedAt?.toISOString() ?? null,
      permissions: acct.permissions,
      createdAt: acct.createdAt.toISOString(),
      _count: { strategies: acct._count.strategies },
      tenant: acct.tenant,
    };
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Trading Accounts"
        description="Connect and manage your exchange accounts"
      />
      <AccountsClient initialAccounts={serialized} />
    </div>
  );
}

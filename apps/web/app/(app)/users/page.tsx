import { prisma } from "@/lib/db";
import { requirePageAuth } from "@/lib/require-auth";
import { UsersClient } from "@/components/accounts/UsersClient";

export default async function UsersPage() {
  const session = await requirePageAuth();

  const where =
    session.role === "SUPER_ADMIN" ? {} : { tenantId: session.tenantId };

  const users = await prisma.user.findMany({
    where,
    include: { tenant: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  // Serialize Prisma dates to plain objects for client component
  const serializedUsers = users.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <UsersClient initialUsers={serializedUsers as never} />
    </div>
  );
}

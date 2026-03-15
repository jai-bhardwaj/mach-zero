/**
 * Custom NextAuth adapter that maps to our Prisma User model.
 *
 * Our User model has tenantId, role, username, etc. — different from
 * the default NextAuth adapter expectations. This adapter:
 * - Auto-provisions new users as VIEWER under the default tenant
 * - Stores OAuth account links in AuthAccount
 * - Stores email verification tokens in VerificationToken
 * - Uses JWT sessions (no Session table needed)
 */
import type { Adapter, AdapterUser, AdapterAccount } from "next-auth/adapters";
import { prisma } from "./db";

type PrismaUser = {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
};

function toAdapterUser(user: PrismaUser): AdapterUser {
  return {
    id: user.id,
    name: user.username,
    email: user.email,
    emailVerified: user.createdAt,
    image: null,
  };
}

// Emails that should be auto-provisioned as SUPER_ADMIN (comma-separated in .env)
const superAdminEmails = new Set(
  (process.env.SUPER_ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
);

export const authAdapter: Adapter = {
  async createUser(data) {
    const defaultTenant = await prisma.tenant.findFirst({
      where: { slug: "default" },
    });
    if (!defaultTenant) throw new Error("No default tenant found");

    const isSuperAdmin = superAdminEmails.has(data.email.toLowerCase());

    const user = await prisma.user.create({
      data: {
        email: data.email,
        username: data.name ?? data.email.split("@")[0],
        password: "",
        role: isSuperAdmin ? "SUPER_ADMIN" : "VIEWER",
        tenantId: defaultTenant.id,
      },
    });
    return toAdapterUser(user);
  },

  async getUser(id) {
    const user = await prisma.user.findUnique({ where: { id } });
    return user ? toAdapterUser(user) : null;
  },

  async getUserByEmail(email) {
    const user = await prisma.user.findUnique({ where: { email } });
    return user ? toAdapterUser(user) : null;
  },

  async getUserByAccount({ provider, providerAccountId }) {
    const account = await prisma.authAccount.findUnique({
      where: {
        provider_providerAccountId: { provider, providerAccountId },
      },
      include: { user: true },
    });
    return account ? toAdapterUser(account.user) : null;
  },

  async updateUser(data) {
    if (!data.id) return data as AdapterUser;
    const user = await prisma.user.findUnique({ where: { id: data.id } });
    return user ? toAdapterUser(user) : (data as AdapterUser);
  },

  async linkAccount(data: AdapterAccount): Promise<void> {
    await prisma.authAccount.create({
      data: {
        userId: data.userId,
        type: data.type,
        provider: data.provider,
        providerAccountId: data.providerAccountId,
        refresh_token: data.refresh_token ?? null,
        access_token: data.access_token ?? null,
        expires_at: data.expires_at ?? null,
        token_type: data.token_type ?? null,
        scope: data.scope ?? null,
        id_token: data.id_token ?? null,
        session_state: data.session_state as string ?? null,
      },
    });
  },

  async unlinkAccount({ provider, providerAccountId }) {
    await prisma.authAccount.delete({
      where: {
        provider_providerAccountId: { provider, providerAccountId },
      },
    });
  },

  async createVerificationToken(data) {
    return prisma.verificationToken.create({ data });
  },

  async useVerificationToken({ identifier, token }) {
    try {
      return await prisma.verificationToken.delete({
        where: { identifier_token: { identifier, token } },
      });
    } catch {
      return null;
    }
  },

  // Not used with JWT strategy — no-op implementations
  async createSession() {
    return null as unknown as ReturnType<NonNullable<Adapter["createSession"]>>;
  },
  async getSessionAndUser() {
    return null;
  },
  async updateSession() {
    return null;
  },
  async deleteSession() {},
};

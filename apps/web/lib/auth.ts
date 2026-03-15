import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import Nodemailer from "next-auth/providers/nodemailer";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "./db";
import { authAdapter } from "./auth-adapter";
import { authConfig } from "./auth.config";

const isDev = process.env.NODE_ENV === "development";

// Build providers list — Credentials only available in development
const providers = [
  Google({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    allowDangerousEmailAccountLinking: true,
  }),
  Apple({
    clientId: process.env.APPLE_CLIENT_ID!,
    clientSecret: process.env.APPLE_CLIENT_SECRET!,
    allowDangerousEmailAccountLinking: true,
  }),
  Nodemailer({
    server: process.env.EMAIL_SERVER || "smtp://localhost:1025",
    from: process.env.EMAIL_FROM || "Mach-Zero <noreply@mach-zero.dev>",
  }),
  // Dev-only credentials provider — auto-provisions or finds a dev user
  ...(isDev
    ? [
        Credentials({
          id: "dev-credentials",
          name: "Dev Login",
          credentials: {
            email: { label: "Email", type: "email" },
          },
          async authorize(credentials) {
            if (!isDev) return null;

            const email =
              (credentials?.email as string) || "dev@mach-zero.dev";

            // Find or create the dev user
            let user = await prisma.user.findUnique({
              where: { email },
              include: { tenant: true },
            });

            if (!user) {
              // Auto-provision: find default tenant
              const defaultTenant = await prisma.tenant.findFirst({
                where: { slug: "default" },
              });
              if (!defaultTenant)
                throw new Error("No default tenant found. Run prisma db seed.");

              user = await prisma.user.create({
                data: {
                  email,
                  username: email.split("@")[0],
                  password: "",
                  role: "SUPER_ADMIN",
                  tenantId: defaultTenant.id,
                  onboardingComplete: true,
                },
                include: { tenant: true },
              });
            }

            return {
              id: user.id,
              email: user.email,
              name: user.username,
            };
          },
        }),
      ]
    : []),
];

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: authAdapter,
  session: { strategy: "jwt" },
  providers,
  callbacks: {
    ...authConfig.callbacks,

    async signIn({ user, account }) {
      if (!user.email) return false;

      // Dev credentials bypass — skip active check for dev provider
      if (account?.provider === "dev-credentials" && isDev) return true;

      // Look up user in local Prisma DB — adapter may have already created
      const localUser = await prisma.user.findUnique({
        where: { email: user.email },
      });

      // User exists — check active status
      if (localUser) return localUser.active;

      // New user — adapter's createUser will handle provisioning
      return true;
    },

    async jwt({ token, trigger }) {
      // On sign-in, session update, or when role is missing, enrich from local DB
      if (trigger === "signIn" || trigger === "update" || !token.role) {
        const localUser = await prisma.user.findUnique({
          where: { email: token.email! },
          include: { tenant: true },
        });
        if (localUser) {
          token.role = localUser.role;
          token.tenantId = localUser.tenantId;
          token.tenantName = localUser.tenant.name;
          token.onboardingComplete = localUser.onboardingComplete;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        const u = session.user as unknown as Record<string, unknown>;
        u.id = token.sub;
        u.role = token.role;
        u.tenantId = token.tenantId;
        u.tenantName = token.tenantName;
        u.onboardingComplete = token.onboardingComplete;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
});

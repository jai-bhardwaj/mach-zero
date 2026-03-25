import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "./db";
import { authAdapter } from "./auth-adapter";
import { authConfig } from "./auth.config";

const isDev = process.env.NODE_ENV === "development";

// Send magic link via Gmail SMTP (works for any recipient)
async function sendVerificationRequest({
  identifier: email,
  url,
}: {
  identifier: string;
  url: string;
  [key: string]: unknown;
}) {
  const { createTransport } = await import("nodemailer");
  const from = process.env.EMAIL_FROM || "Mach-Zero <noreply@mach-zero.dev>";
  const transport = createTransport(process.env.EMAIL_SERVER || "smtp://localhost:1025");

  await transport.sendMail({
    from,
    to: email,
    subject: "Sign in to Mach-Zero",
    html: `
      <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #fff; background: #2563eb; padding: 12px 20px; border-radius: 8px; text-align: center;">Mach-Zero</h2>
        <p>Click the button below to sign in:</p>
        <a href="${url}" style="display: block; background: #2563eb; color: #fff; padding: 12px 20px; border-radius: 6px; text-decoration: none; text-align: center; font-weight: 600; margin: 20px 0;">Sign in to Mach-Zero</a>
        <p style="color: #666; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}

// Build providers list — Credentials only available in development
const providers = [
  Google({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    allowDangerousEmailAccountLinking: true,
  }),
  Nodemailer({
    server: process.env.EMAIL_SERVER || "smtp://localhost:1025",
    from: process.env.EMAIL_FROM || "Mach-Zero <noreply@mach-zero.dev>",
    sendVerificationRequest,
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

/**
 * Edge-compatible NextAuth config.
 *
 * This file contains ONLY the parts of the auth config that can run
 * in Edge runtime (middleware). No Prisma, no Nodemailer, no Node.js APIs.
 *
 * The full config (with providers, adapter, DB callbacks) lives in auth.ts.
 */
import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
    verifyRequest: "/verify-request",
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const pathname = request.nextUrl.pathname;
      const isLoginPage = pathname === "/login";
      const isVerifyPage = pathname === "/verify-request";
      const isApiRoute = pathname.startsWith("/api/");

      if (isApiRoute) {
        // API routes handle their own auth via requireAuth()
        return true;
      }
      if (isLoginPage || isVerifyPage) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/dashboard", request.nextUrl));
        }
        return true;
      }
      return isLoggedIn; // false → redirects to pages.signIn ("/login")
    },
  },
  providers: [], // Providers are configured in auth.ts (not edge-compatible)
} satisfies NextAuthConfig;

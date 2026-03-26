import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Protect all (app) routes, skip static assets and API routes
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|login|verify-request|onboarding).*)",
  ],
};

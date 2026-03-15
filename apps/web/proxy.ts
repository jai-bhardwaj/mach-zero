import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Use the edge-compatible config (no Prisma, no Nodemailer)
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: [
    // Protect all routes EXCEPT: login, verify-request, api/auth, api/health, static assets, _next
    "/((?!login|verify-request|api/auth|api/health|_next/static|_next/image|favicon.ico).*)",
  ],
};

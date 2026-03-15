import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export type AuthSession = {
  userId: string;
  email: string;
  role: string;
  tenantId: string;
  tenantName: string;
};

/**
 * API route auth guard — returns AuthSession or a 401/403 NextResponse.
 * Pass allowed roles to restrict access (empty = any authenticated user).
 */
export async function requireAuth(
  ...allowedRoles: string[]
): Promise<AuthSession | NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as unknown as Record<string, unknown>;
  const authSession: AuthSession = {
    userId: user.id as string,
    email: user.email as string,
    role: user.role as string,
    tenantId: user.tenantId as string,
    tenantName: user.tenantName as string,
  };

  if (allowedRoles.length > 0 && !allowedRoles.includes(authSession.role)) {
    return NextResponse.json(
      { error: "Insufficient permissions" },
      { status: 403 }
    );
  }

  return authSession;
}

/**
 * Server Component auth guard — returns AuthSession or redirects to /login.
 */
export async function requirePageAuth(): Promise<AuthSession> {
  const session = await auth();
  if (!session?.user) {
    const { redirect } = await import("next/navigation");
    redirect("/login"); // redirect() throws internally and never returns
  }

  // After the guard above, session.user is guaranteed non-null
  const user = session!.user as unknown as Record<string, unknown>;
  return {
    userId: user.id as string,
    email: user.email as string,
    role: user.role as string,
    tenantId: user.tenantId as string,
    tenantName: user.tenantName as string,
  };
}

/** Type guard — checks if requireAuth returned an error response */
export function isAuthError(
  result: AuthSession | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, isAuthError } from "@/lib/require-auth";

// POST /api/onboarding/complete — mark onboarding as done
export async function POST() {
  try {
    const session = await requireAuth();
    if (isAuthError(session)) return session;

    await prisma.user.update({
      where: { id: session.userId },
      data: { onboardingComplete: true },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to complete onboarding" },
      { status: 500 }
    );
  }
}

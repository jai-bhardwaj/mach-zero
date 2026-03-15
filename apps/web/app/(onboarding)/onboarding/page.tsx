import { requirePageAuth } from "@/lib/require-auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export default async function OnboardingPage() {
  const session = await requirePageAuth();

  // If already onboarded, go to dashboard
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { onboardingComplete: true },
  });
  if (user?.onboardingComplete) redirect("/dashboard");

  // Fetch strategy templates for step 3
  const templates = await prisma.strategyTemplate.findMany({
    where: { active: true },
    orderBy: [{ featured: "desc" }, { returnPct: "desc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      category: true,
      riskLevel: true,
      symbolIds: true,
      returnPct: true,
      winRate: true,
      sharpeRatio: true,
      featured: true,
      minCapital: true,
    },
  });

  // Serialize for client component
  const serializedTemplates = templates.map((t) => ({
    ...t,
    category: t.category as string,
    riskLevel: t.riskLevel as string,
  }));

  return <OnboardingWizard templates={serializedTemplates} />;
}

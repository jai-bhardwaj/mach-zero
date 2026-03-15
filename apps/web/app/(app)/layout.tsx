import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { TradingModeProvider } from "@/contexts/TradingModeContext";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Redirect to onboarding if user hasn't completed it
  const session = await auth();
  if (session?.user) {
    const u = session.user as unknown as Record<string, unknown>;
    const dbUser = await prisma.user.findUnique({
      where: { id: u.id as string },
      select: { onboardingComplete: true },
    });
    if (dbUser && !dbUser.onboardingComplete) {
      redirect("/onboarding");
    }
  }

  return (
    <TradingModeProvider>
      <div className="flex h-screen overflow-hidden">
        <div className="hidden md:flex">
          <Sidebar />
        </div>
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto px-3 py-4 sm:px-5 md:px-6">
            {children}
          </main>
        </div>
      </div>
    </TradingModeProvider>
  );
}

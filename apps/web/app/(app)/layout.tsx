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
    const userId = u.id as string | undefined;
    if (userId) {
      let shouldOnboard = false;
      try {
        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { onboardingComplete: true },
        });
        if (dbUser && !dbUser.onboardingComplete) {
          shouldOnboard = true;
        }
      } catch {
        // DB query failed — continue without redirect
      }
      if (shouldOnboard) {
        redirect("/onboarding");
      }
    }
  }

  return (
    <TradingModeProvider>
      {/* h-dvh (dynamic viewport height) + overflow-hidden pins the whole app
          shell to the visible viewport on every device/browser-chrome state,
          so only inner regions (nav, main) scroll — never the page. */}
      <div className="flex h-dvh max-h-dvh w-full max-w-[100vw] overflow-hidden">
        <div className="hidden md:flex">
          <Sidebar />
        </div>
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto px-3 py-4 sm:px-5 md:px-6">
            {children}
          </main>
        </div>
      </div>
    </TradingModeProvider>
  );
}

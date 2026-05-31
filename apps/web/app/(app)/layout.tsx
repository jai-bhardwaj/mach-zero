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
      {/* h-screen (100vh) is a definite, universally-supported viewport height;
          overflow-hidden pins the whole app shell to the viewport so only inner
          regions (nav, main) scroll — never the page. The sidebar wrapper gets
          its OWN h-screen rather than relying on flex-stretch, so the sidebar
          footer (Sign out / Collapse) is always anchored to the viewport bottom
          even in browsers that don't honor dynamic-viewport units. */}
      <div className="flex h-screen w-full max-w-[100vw] overflow-hidden">
        <div className="hidden h-screen md:flex">
          <Sidebar />
        </div>
        <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto px-3 py-4 sm:px-5 md:px-6 [scrollbar-gutter:stable]">
            {children}
          </main>
        </div>
      </div>
    </TradingModeProvider>
  );
}

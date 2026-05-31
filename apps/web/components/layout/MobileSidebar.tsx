"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { filterNavByRole, type NavItem } from "@/lib/nav-items";
import { useTradingMode } from "@/contexts/TradingModeContext";
import { Sheet, SheetTrigger, SheetContent, SheetClose } from "@/components/ui/sheet";
import { Menu, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

/** Group nav items by section, preserving order */
function groupBySection(items: NavItem[]) {
  const groups: { section: string | undefined; items: NavItem[] }[] = [];
  let currentSection: string | undefined = "__initial__";

  for (const item of items) {
    if (item.section !== currentSection) {
      currentSection = item.section;
      groups.push({ section: currentSection, items: [item] });
    } else {
      groups[groups.length - 1].items.push(item);
    }
  }
  return groups;
}

export function MobileSidebar() {
  const pathname = usePathname();
  const { hasLiveStrategies, liveCount } = useTradingMode();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  const userRole = (session?.user as Record<string, unknown> | undefined)
    ?.role as string | undefined;
  const userName = session?.user?.name ?? "User";
  const tenantName = (session?.user as Record<string, unknown> | undefined)
    ?.tenantName as string | undefined;

  const visibleItems = useMemo(() => filterNavByRole(userRole), [userRole]);
  const groupedItems = useMemo(() => groupBySection(visibleItems), [visibleItems]);

  const initials = userName
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors md:hidden"
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Open menu</span>
      </SheetTrigger>

      <SheetContent side="left" className="w-64">
        {/* Logo */}
        <div className="flex h-11 items-center border-b border-sidebar-border px-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5"
            onClick={() => setOpen(false)}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
              M0
            </span>
            <span className="text-sm font-semibold text-sidebar-foreground">
              Mach-Zero
            </span>
          </Link>
        </div>

        {/* Trading mode indicator */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-sidebar-border">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full shrink-0",
              hasLiveStrategies ? "bg-red-400 animate-pulse" : "bg-blue-400"
            )}
          />
          <span className="text-[11px] text-muted-foreground">
            {hasLiveStrategies ? `${liveCount} Live` : "Paper Trading"}
          </span>
        </div>

        {/* Navigation with sections */}
        <nav className="flex-1 p-3 overflow-auto">
          {groupedItems.map((group, groupIndex) => (
            <div key={group.section ?? `group-${groupIndex}`}>
              {groupIndex > 0 && (
                <div className="my-2 mx-2 border-t border-sidebar-border" />
              )}
              {group.section && group.section !== "Settings" && (
                <p className="px-3 pt-1 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">
                  {group.section}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = pathname?.startsWith(item.href);
                  const Icon = item.icon;

                  return (
                    <SheetClose
                      key={item.href}
                      nativeButton={false}
                      render={
                        <Link
                          href={item.href}
                          className={cn(
                            "flex items-center gap-3 rounded-md px-3 py-[5px] text-sm transition-colors",
                            active
                              ? "border-l-2 border-primary bg-transparent text-sidebar-foreground font-medium pl-[10px]"
                              : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground border-l-2 border-transparent pl-[10px]"
                          )}
                        />
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </SheetClose>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-3 space-y-1">
          {/* User info */}
          <div className="flex items-center gap-2.5 px-3 py-1">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-sidebar-foreground">
                {userName}
              </p>
              {tenantName && (
                <p className="truncate text-[10px] text-muted-foreground">
                  {tenantName}
                </p>
              )}
            </div>
          </div>

          {/* Sign out */}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-3 rounded-md px-3 py-[5px] text-sm text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign out
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

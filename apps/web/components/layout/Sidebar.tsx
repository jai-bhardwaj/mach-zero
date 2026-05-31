"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  filterNavByRole,
  filterSettingsNavByRole,
  isSettingsRoute,
  type NavItem,
} from "@/lib/nav-items";
import { useTradingMode } from "@/contexts/TradingModeContext";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowLeft, ChevronsLeft, ChevronsRight, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

const STORAGE_KEY = "sidebar-collapsed";
const STORAGE_EVENT = "sidebar-collapsed-change";

function subscribeSidebarCollapsed(callback: () => void) {
  window.addEventListener(STORAGE_EVENT, callback);
  return () => window.removeEventListener(STORAGE_EVENT, callback);
}

function getSidebarSnapshot() {
  return localStorage.getItem(STORAGE_KEY) === "true";
}

function getSidebarServerSnapshot() {
  return false;
}

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

export function Sidebar() {
  const pathname = usePathname();
  const { hasLiveStrategies, liveCount } = useTradingMode();
  const { data: session } = useSession();

  const userRole = (session?.user as Record<string, unknown> | undefined)
    ?.role as string | undefined;
  const userName = session?.user?.name ?? "User";
  const tenantName = (session?.user as Record<string, unknown> | undefined)
    ?.tenantName as string | undefined;

  // In the Settings area the sidebar swaps in place to the settings nav (+ a
  // Back button) rather than showing a separate sub-sidebar beside the content.
  const inSettings = isSettingsRoute(pathname ?? "");
  const visibleItems = useMemo(
    () =>
      inSettings ? filterSettingsNavByRole(userRole) : filterNavByRole(userRole),
    [inSettings, userRole]
  );
  const groupedItems = useMemo(() => groupBySection(visibleItems), [visibleItems]);

  const collapsed = useSyncExternalStore(
    subscribeSidebarCollapsed,
    getSidebarSnapshot,
    getSidebarServerSnapshot,
  );

  const toggle = useCallback(() => {
    const current = localStorage.getItem(STORAGE_KEY) === "true";
    localStorage.setItem(STORAGE_KEY, String(!current));
    window.dispatchEvent(new Event(STORAGE_EVENT));
  }, []);

  const initials = userName
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside
      className={cn(
        "flex h-full flex-col overflow-hidden border-r border-sidebar-border bg-sidebar transition-all duration-200",
        collapsed ? "w-[52px]" : "w-56"
      )}
    >
      {/* Logo + trading mode indicator */}
      <div className="flex h-11 items-center border-b border-sidebar-border px-3">
        <Link href="/dashboard" className="flex items-center gap-2.5 overflow-hidden">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            M0
          </span>
          <span
            className={cn(
              "text-sm font-semibold text-sidebar-foreground whitespace-nowrap transition-all duration-200",
              collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
            )}
          >
            Mach-Zero
          </span>
        </Link>
      </div>

      {/* Swappable region (mode/back block + nav), keyed on inSettings so it
          remounts and slide-animates ONLY when crossing the app<->settings
          boundary — not on within-section navigation — synced with main's fade.
          Settings slides in from the right; the app nav slides back from left. */}
      <div
        key={inSettings ? "settings-nav" : "app-nav"}
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          inSettings
            ? "animate-[navSlideInRight_180ms_ease-out]"
            : "animate-[navSlideInLeft_180ms_ease-out]"
        )}
      >
      {/* Settings mode: a "Back to app" button (+ section label) replaces the
          trading-mode indicator, so the single sidebar swaps cleanly between the
          app nav and the settings nav. */}
      {inSettings ? (
        collapsed ? (
          <div className="border-b border-sidebar-border p-2">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Link
                    href="/dashboard"
                    aria-label="Back to app"
                    className="flex justify-center rounded-md px-2.5 py-[5px] text-sm text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4 shrink-0" />
                  </Link>
                }
              />
              <TooltipContent side="right" sideOffset={8}>
                Back to app
              </TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <div className="border-b border-sidebar-border p-2">
            <Link
              href="/dashboard"
              className="flex items-center gap-2.5 rounded-md px-2.5 py-[5px] text-sm text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />
              <span>Back to app</span>
            </Link>
            <p className="px-2.5 pt-2 text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">
              Settings
            </p>
          </div>
        )
      ) : (
        !collapsed && (
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
        )
      )}

      {/* Navigation with section grouping.
          min-h-0 lets the nav shrink and scroll instead of pushing the footer
          (user + Sign out + collapse) below the viewport when items overflow. */}
      <nav className="flex-1 min-h-0 overflow-y-auto p-2">
        {groupedItems.map((group, groupIndex) => (
          <div key={group.section ?? `group-${groupIndex}`}>
            {/* Section separator (not for first group) */}
            {groupIndex > 0 && (
              <div className="my-2 mx-2 border-t border-sidebar-border" />
            )}
            {/* Section label (only for named sections, not collapsed) */}
            {group.section && group.section !== "Settings" && !collapsed && (
              <p className="px-2.5 pt-1 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">
                {group.section}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                // "/settings" (General) must match exactly, else it would also
                // light up on /settings/notifications.
                const active =
                  item.href === "/settings"
                    ? pathname === "/settings"
                    : pathname?.startsWith(item.href);
                const Icon = item.icon;

                const link = (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-[5px] text-sm transition-all duration-100",
                      active
                        ? "border-l-2 border-primary bg-transparent text-sidebar-foreground font-medium pl-[8px]"
                        : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground border-l-2 border-transparent pl-[8px]"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span
                      className={cn(
                        "whitespace-nowrap transition-all duration-200",
                        collapsed ? "w-0 overflow-hidden opacity-0" : "w-auto opacity-100"
                      )}
                    >
                      {item.label}
                    </span>
                  </Link>
                );

                if (collapsed) {
                  return (
                    <Tooltip key={item.href}>
                      <TooltipTrigger render={link} />
                      <TooltipContent side="right" sideOffset={8}>
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return link;
              })}
            </div>
          </div>
        ))}
      </nav>
      </div>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-2 space-y-1">
        {/* User info */}
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <div className="flex justify-center">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                    {initials}
                  </span>
                </div>
              }
            />
            <TooltipContent side="right" sideOffset={8}>
              <p className="font-medium">{userName}</p>
              {tenantName && (
                <p className="text-xs text-muted-foreground">{tenantName}</p>
              )}
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-2 px-2.5 py-1">
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
        )}

        {/* Sign out */}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className={cn(
            "flex w-full items-center rounded-md px-2.5 py-[5px] text-sm text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors",
            collapsed ? "justify-center" : "gap-2.5"
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>

        {/* Collapse toggle — labelled so it's a discoverable control, not a
            faint unlabelled chevron at the bottom edge. */}
        <button
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex w-full items-center rounded-md px-2.5 py-[5px] text-sm text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors",
            collapsed ? "justify-center" : "gap-2.5"
          )}
        >
          {collapsed ? (
            <ChevronsRight className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronsLeft className="h-4 w-4 shrink-0" />
          )}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}

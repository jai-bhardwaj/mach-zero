"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { filterSettingsNavByRole } from "@/lib/nav-items";
import { cn } from "@/lib/utils";

// Secondary sidebar for the Settings area. Mirrors the primary sidebar's
// role-gating + active-route highlighting, scoped to settings/admin items.
export function SettingsNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const items = filterSettingsNavByRole(role);

  return (
    <nav className="w-full shrink-0 space-y-0.5 overflow-y-auto md:w-48 md:pr-2">
      {items.map((item, i) => {
        // /settings is "General" — only active on exact match, since every
        // settings route starts with /settings.
        const active =
          item.href === "/settings"
            ? pathname === "/settings"
            : pathname === item.href || pathname.startsWith(item.href + "/");
        // Show a section label when this item starts a new section.
        const showSection = item.section && item.section !== items[i - 1]?.section;
        const Icon = item.icon;
        return (
          <div key={item.href}>
            {showSection && (
              <p className="px-2.5 pt-3 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">
                {item.section}
              </p>
            )}
            <Link
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          </div>
        );
      })}
    </nav>
  );
}

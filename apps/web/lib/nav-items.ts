import {
  LayoutDashboard,
  ArrowLeftRight,
  Cpu,
  Store,
  ShieldAlert,
  BarChart3,
  Wallet,
  Users,
  Building2,
  Activity,
  Settings,
  FlaskConical,
  Bell,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** If set, only these roles can see this item. Undefined = visible to all. */
  roles?: string[];
  /** Section grouping for sidebar separators */
  section?: string;
}

// Primary sidebar — the day-to-day trading surface, kept lean. Configuration
// and admin live under Settings (SETTINGS_NAV_ITEMS) with their own nav.
export const NAV_ITEMS: NavItem[] = [
  // Core
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/trades", label: "Trades", icon: ArrowLeftRight },
  { href: "/strategies", label: "Strategies", icon: Cpu },
  { href: "/marketplace", label: "Marketplace", icon: Store },
  // Operations
  { href: "/risk", label: "Risk", icon: ShieldAlert, section: "Operations" },
  { href: "/reports", label: "Reports", icon: BarChart3, section: "Operations" },
  { href: "/backtest", label: "Backtest", icon: FlaskConical, section: "Operations" },
  // Settings (standalone — opens the settings area)
  { href: "/settings", label: "Settings", icon: Settings, section: "Settings" },
];

// Secondary nav shown inside the Settings area (its own sidebar). Config +
// admin items moved off the primary sidebar to declutter it.
export const SETTINGS_NAV_ITEMS: NavItem[] = [
  { href: "/settings", label: "General", icon: Settings },
  { href: "/accounts", label: "Accounts", icon: Wallet },
  { href: "/settings/notifications", label: "Alerts", icon: Bell },
  // Admin
  { href: "/workspaces", label: "Workspaces", icon: Building2, roles: ["SUPER_ADMIN"], section: "Admin" },
  { href: "/users", label: "Users", icon: Users, roles: ["SUPER_ADMIN", "ADMIN"], section: "Admin" },
  { href: "/system", label: "System", icon: Activity, roles: ["SUPER_ADMIN", "ADMIN"], section: "Admin" },
];

/** Filter nav items to only those visible to the given role */
export function filterNavByRole(role: string | undefined): NavItem[] {
  if (!role) return [];
  return NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));
}

/** Filter settings nav items to only those visible to the given role */
export function filterSettingsNavByRole(role: string | undefined): NavItem[] {
  if (!role) return [];
  return SETTINGS_NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));
}

// Top-level path prefixes that belong to the Settings area. When the current
// route matches one of these, the sidebar swaps in place to the settings nav
// (with a Back button) instead of the main app nav.
const SETTINGS_ROUTE_PREFIXES = [
  "/settings",
  "/accounts",
  "/workspaces",
  "/users",
  "/system",
];

/** True when the given pathname is within the Settings area. */
export function isSettingsRoute(pathname: string): boolean {
  return SETTINGS_ROUTE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

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

export const NAV_ITEMS: NavItem[] = [
  // Core
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/trades", label: "Trades", icon: ArrowLeftRight },
  { href: "/strategies", label: "Strategies", icon: Cpu },
  { href: "/marketplace", label: "Marketplace", icon: Store },
  // Operations
  { href: "/risk", label: "Risk", icon: ShieldAlert, section: "Operations" },
  { href: "/reports", label: "Reports", icon: BarChart3, section: "Operations" },
  { href: "/accounts", label: "Accounts", icon: Wallet, section: "Operations" },
  { href: "/backtest", label: "Backtest", icon: FlaskConical, section: "Operations" },
  { href: "/settings/notifications", label: "Alerts", icon: Bell, section: "Operations" },
  // Admin
  {
    href: "/workspaces",
    label: "Workspaces",
    icon: Building2,
    roles: ["SUPER_ADMIN"],
    section: "Admin",
  },
  {
    href: "/users",
    label: "Users",
    icon: Users,
    roles: ["SUPER_ADMIN", "ADMIN"],
    section: "Admin",
  },
  {
    href: "/system",
    label: "System",
    icon: Activity,
    roles: ["SUPER_ADMIN", "ADMIN"],
    section: "Admin",
  },
  // Settings (standalone)
  { href: "/settings", label: "Settings", icon: Settings, section: "Settings" },
];

/** Filter nav items to only those visible to the given role */
export function filterNavByRole(role: string | undefined): NavItem[] {
  if (!role) return [];
  return NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));
}

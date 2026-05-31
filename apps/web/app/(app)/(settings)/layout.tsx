import { SettingsNav } from "@/components/layout/SettingsNav";

// Shared layout for the Settings area (settings, accounts, alerts, and admin:
// workspaces/users/system). Renders a secondary nav beside the page content.
// This is a route group — URLs are unchanged (/accounts, /users, ...).
export default function SettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 md:flex-row md:gap-6">
      <SettingsNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

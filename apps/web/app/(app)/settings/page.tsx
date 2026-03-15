import { AccountSettings } from "@/components/settings/AccountSettings";
import { ThemeSettings } from "@/components/settings/ThemeSettings";
import { TradingModeSettings } from "@/components/settings/TradingModeSettings";
import { PageHeader } from "@/components/ui/page-header";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 sm:space-y-6">
      <PageHeader title="Settings" description="Manage your account, preferences, and trading configuration" />

      <AccountSettings />
      <ThemeSettings />
      <TradingModeSettings />
    </div>
  );
}

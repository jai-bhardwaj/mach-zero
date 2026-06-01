// Settings pages render full-width. The primary app sidebar swaps in place to
// the settings nav (with a "Back to app" button) when inside the Settings area
// — see components/layout/Sidebar.tsx / MobileSidebar.tsx — so there is no
// separate settings sub-sidebar here. This is a route group; URLs are unchanged
// (/accounts, /settings, /users, ...).
export default function SettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}

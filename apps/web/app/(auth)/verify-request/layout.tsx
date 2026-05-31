// Server layout so the client verify-request page can carry a page-specific
// browser-tab title (a "use client" page cannot export metadata).
export const metadata = { title: "Check Your Email | Mach-Zero" };

export default function VerifyRequestLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}

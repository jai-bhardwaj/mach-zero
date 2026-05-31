// Server layout so the client login page can still carry a page-specific
// browser-tab title (a "use client" page cannot export metadata).
export const metadata = { title: "Sign In | Mach-Zero" };

export default function LoginLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}

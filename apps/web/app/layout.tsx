import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { AuthSessionProvider } from "@/components/providers/SessionProvider";
import { PostHogProvider } from "@/components/providers/PostHogProvider";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mach-Zero",
  description: "Ultra-low latency trading system dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <AuthSessionProvider>
          <PostHogProvider>
            <ThemeProvider>
              <TooltipProvider>
                {children}
                <Toaster theme="dark" position="bottom-right" richColors closeButton />
              </TooltipProvider>
            </ThemeProvider>
          </PostHogProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}

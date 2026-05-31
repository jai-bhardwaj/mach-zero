"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

interface Props {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: Props) {
  // Mach-Zero is a dark-only product: the color tokens and trading P&L
  // semantics are designed for dark, and there is no theme toggle in the UI.
  // Force dark so the app never renders the unstyled light :root theme on
  // light-mode OSes (previously defaultTheme="system" leaked light mode).
  return (
    <NextThemesProvider attribute="class" forcedTheme="dark">
      {children}
    </NextThemesProvider>
  );
}

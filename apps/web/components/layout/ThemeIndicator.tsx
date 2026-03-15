"use client";

import { useTheme } from "next-themes";
import { useMounted } from "@/hooks/useMounted";
import { Sun, Moon } from "lucide-react";

export function ThemeIndicator() {
  const { resolvedTheme } = useTheme();
  const mounted = useMounted();

  if (!mounted) {
    return <div className="h-4 w-4" />;
  }

  return resolvedTheme === "dark" ? (
    <Moon className="h-4 w-4 text-muted-foreground" />
  ) : (
    <Sun className="h-4 w-4 text-muted-foreground" />
  );
}

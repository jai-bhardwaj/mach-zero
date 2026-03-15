"use client";

import { useState, useCallback } from "react";

export function useKillSwitch() {
  const [active, setActive] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/kill-switch");
      if (res.ok) {
        const data = await res.json();
        setActive(data.killSwitch);
      }
    } catch {
      setActive(null);
    }
  }, []);

  const toggle = useCallback(
    async (state: "on" | "off") => {
      setLoading(true);
      try {
        const res = await fetch("/api/kill-switch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state }),
        });
        if (res.ok) {
          const data = await res.json();
          setActive(data.killSwitch === true);
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { active, loading, refresh, toggle };
}

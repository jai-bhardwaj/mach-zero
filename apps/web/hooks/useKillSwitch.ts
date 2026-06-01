"use client";

import { useState, useCallback } from "react";

export function useKillSwitch() {
  const [active, setActive] = useState<boolean | null>(null);
  // "source" tells us WHERE the status came from: the API returns
  // source:"fallback" when it could not reach the C++ risk monitor (and is
  // serving local in-memory state instead). In that case the displayed status
  // is not authoritative — the panel must surface that, not claim "Normal".
  const [source, setSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/kill-switch");
      if (res.ok) {
        const data = await res.json();
        setActive(data.killSwitch);
        setSource(data.source ?? null);
      }
    } catch {
      setActive(null);
      setSource(null);
    }
  }, []);

  const toggle = useCallback(
    async (state: "on" | "off"): Promise<boolean> => {
      setLoading(true);
      try {
        const res = await fetch("/api/kill-switch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        setActive(data.killSwitch === true);
        return true;
      } catch {
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { active, source, loading, refresh, toggle };
}

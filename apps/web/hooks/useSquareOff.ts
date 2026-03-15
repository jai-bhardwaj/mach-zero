"use client";

import { useState, useCallback } from "react";
import type { SquareOffRequest, SquareOffResult } from "@/types";

export function useSquareOff() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SquareOffResult | null>(null);

  const squareOff = useCallback(async (request: SquareOffRequest) => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/square-off", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const data: SquareOffResult = await res.json();
      setResult(data);
      return data;
    } catch {
      const errorResult: SquareOffResult = {
        success: false,
        scope: request.scope,
        strategiesPaused: 0,
        killSwitchActivated: false,
        symbolsSquaredOff: 0,
        details: [],
        source: "error",
      };
      setResult(errorResult);
      return errorResult;
    } finally {
      setLoading(false);
    }
  }, []);

  return { squareOff, loading, result };
}

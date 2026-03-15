"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

interface TradingModeState {
  mockCount: number;
  liveCount: number;
  hasLiveStrategies: boolean;
  loading: boolean;
  refresh: () => void;
}

const TradingModeContext = createContext<TradingModeState | null>(null);

export function TradingModeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mockCount, setMockCount] = useState(0);
  const [liveCount, setLiveCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchMode = useCallback(async () => {
    try {
      const res = await fetch("/api/trading-mode");
      if (res.status === 401) {
        // Session expired — redirect to login
        window.location.href = "/login";
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setMockCount(data.mockCount ?? 0);
        setLiveCount(data.liveCount ?? 0);
      }
    } catch {
      // ignore — keep previous state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMode();
    const interval = setInterval(fetchMode, 5000);
    return () => clearInterval(interval);
  }, [fetchMode]);

  return (
    <TradingModeContext.Provider
      value={{
        mockCount,
        liveCount,
        hasLiveStrategies: liveCount > 0,
        loading,
        refresh: fetchMode,
      }}
    >
      {children}
    </TradingModeContext.Provider>
  );
}

export function useTradingMode() {
  const ctx = useContext(TradingModeContext);
  if (!ctx) {
    throw new Error("useTradingMode must be used within TradingModeProvider");
  }
  return ctx;
}

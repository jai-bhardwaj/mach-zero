"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const WS_URL =
  process.env.NEXT_PUBLIC_BRIDGE_WS_URL ?? "";

function isWsUrlUsable(url: string): boolean {
  if (!url) return false;
  if (typeof window !== "undefined" && window.location.protocol === "https:" && url.startsWith("ws://")) {
    return false;
  }
  return true;
}

interface TradeStreamOptions {
  enabled?: boolean;
}

interface TradeStreamReturn {
  connected: boolean;
  newTradeCount: number;
  resetCount: () => void;
}

export function useTradeStream({
  enabled = true,
}: TradeStreamOptions = {}): TradeStreamReturn {
  const [connected, setConnected] = useState(false);
  const [newTradeCount, setNewTradeCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
  const connectRef = useRef<() => void>(null);

  const resetCount = useCallback(() => {
    setNewTradeCount(0);
  }, []);

  useEffect(() => {
    if (!enabled || !isWsUrlUsable(WS_URL)) return;

    let disposed = false;

    const connect = () => {
      if (disposed) return;
      if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!disposed) setConnected(true);
      };

      ws.onmessage = (event) => {
        if (disposed) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === "trade") {
            setNewTradeCount((prev) => prev + 1);
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (disposed) return;
        setConnected(false);
        reconnectTimer.current = setTimeout(
          () => connectRef.current?.(),
          2000,
        );
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connectRef.current = connect;
    connect();

    return () => {
      disposed = true;
      connectRef.current = null;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [enabled]);

  return { connected, newTradeCount, resetCount };
}

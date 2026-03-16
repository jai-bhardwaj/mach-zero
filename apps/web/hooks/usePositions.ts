"use client";

import { useEffect, useRef, useState } from "react";
import type { SymbolState, LiveSnapshot } from "@/types";

const WS_URL = process.env.NEXT_PUBLIC_BRIDGE_WS_URL ?? "";

// Check if WebSocket URL is usable (not empty, and not ws:// on https:// page)
function isWsUrlUsable(url: string): boolean {
  if (!url) return false;
  if (typeof window !== "undefined" && window.location.protocol === "https:" && url.startsWith("ws://")) {
    return false;
  }
  return true;
}

export function usePositions() {
  const [symbols, setSymbols] = useState<SymbolState[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
  const connectRef = useRef<() => void>(null);

  useEffect(() => {
    if (!isWsUrlUsable(WS_URL)) return;

    const connect = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);

      ws.onmessage = (event) => {
        try {
          const data: LiveSnapshot = JSON.parse(event.data);
          if (data.type === "snapshot") {
            setSymbols(data.symbols);
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        reconnectTimer.current = setTimeout(() => connectRef.current?.(), 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connectRef.current = connect;
    connect();

    return () => {
      connectRef.current = null;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, []);

  return { symbols, connected };
}

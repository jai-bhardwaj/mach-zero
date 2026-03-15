"use client";

import { useEffect, useRef, useState } from "react";
import type { SymbolState, LiveSnapshot } from "@/types";

const WS_URL = process.env.NEXT_PUBLIC_BRIDGE_WS_URL ?? "ws://localhost:3002/ws/live";

export function usePositions() {
  const [symbols, setSymbols] = useState<SymbolState[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
  const connectRef = useRef<() => void>(null);

  useEffect(() => {
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

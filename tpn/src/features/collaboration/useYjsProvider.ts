import { useEffect, useMemo, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

import { resolveWsUrl } from "../../config/network";

export function useYjsProvider(roomId: string, enabled = true) {
  const [connected, setConnected] = useState(false);

  const ydoc = useMemo(() => new Y.Doc({ guid: roomId }), [roomId]);
  const wsUrl = useMemo(() => {
    const envUrl = import.meta.env.VITE_WS_URL as string | undefined;
    return resolveWsUrl(envUrl);
  }, []);

  const provider = useMemo(() => {
    return new WebsocketProvider(wsUrl, roomId, ydoc, {
      connect: false,
    });
  }, [roomId, ydoc, wsUrl]);

  useEffect(() => {
    if (!enabled) {
      provider.disconnect();
      setConnected(false);
      return;
    }

    const handleStatus = (event: { status: string }) => {
      console.log(`Yjs Connection Status: ${event.status} RoomID: ${roomId}`);
      setConnected(event.status === "connected");
    };

    const handleConnectionClose = (event: CloseEvent | null) => {
      console.log("Yjs connection-close", { roomId, event });
      setConnected(false);
    };

    const handleConnectionError = (event: Event | CloseEvent | null) => {
      console.log("Yjs connection-error", { roomId, event });
    };

    const reconnectIfVisible = () => {
      if (document.visibilityState === "hidden") return;
      provider.connect();
    };

    provider.on("status", handleStatus);
    provider.on("connection-close", handleConnectionClose);
    provider.on("connection-error", handleConnectionError);
    window.addEventListener("pageshow", reconnectIfVisible);
    document.addEventListener("visibilitychange", reconnectIfVisible);
    provider.connect();

    return () => {
      provider.off("status", handleStatus);
      provider.off("connection-close", handleConnectionClose);
      provider.off("connection-error", handleConnectionError);
      window.removeEventListener("pageshow", reconnectIfVisible);
      document.removeEventListener("visibilitychange", reconnectIfVisible);
      provider.disconnect();
    };
  }, [provider, roomId, enabled]);

  return { ydoc, provider, connected };
}

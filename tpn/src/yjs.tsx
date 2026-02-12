import { useEffect, useMemo, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

export function useYjsProvider(roomId: string) {
  const [connected, setConnected] = useState(false);

  const ydoc = useMemo(() => new Y.Doc(), [roomId]);
  const wsUrl = useMemo(() => {
    const envUrl = import.meta.env.VITE_WS_URL as string | undefined;
    if (envUrl) return envUrl;
    return `ws://${window.location.hostname}:1234`;
  }, []);

  const provider = useMemo(() => {
    return new WebsocketProvider(wsUrl, roomId, ydoc, {
      connect: false,
    });
  }, [roomId, ydoc, wsUrl]);

  useEffect(() => {
    const handleStatus = (event: { status: string }) => {
      console.log(`Yjs Connection Status: ${event.status} RoomID: ${roomId}`);
      setConnected(event.status === "connected");
    };

    provider.on("status", handleStatus);
    provider.connect();

    return () => {
      provider.off("status", handleStatus);
      provider.disconnect();
      // provider.destroy();
      // ydoc.destroy();
    };
  }, [provider, ydoc, roomId]);

  return { ydoc, provider, connected };
}

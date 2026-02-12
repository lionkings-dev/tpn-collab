import { useEffect, useMemo, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

export function useYjsProvider(roomId: string) {
  const [connected, setConnected] = useState(false);

  const ydoc = useMemo(() => new Y.Doc(), [roomId]);

  const provider = useMemo(() => {
    return new WebsocketProvider("ws://localhost:1234", roomId, ydoc, {
      connect: false,
    });
  }, [roomId, ydoc]);

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

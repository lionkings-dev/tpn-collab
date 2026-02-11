import { useEffect, useMemo, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

export function useYjsProvider(roomId: string) {
  // Stable Y.Doc instance for the given roomId
  const ydoc = useMemo(() => new Y.Doc(), [roomId]);
  const [connected, setConnected] = useState(false);

  // Initialize provider without connecting immediately
  const provider = useMemo(() => {
    return new WebsocketProvider("ws://localhost:1234", roomId, ydoc, {
      connect: false,
    });
  }, [roomId, ydoc]);

  useEffect(() => {
    // Explicitly connect when the component mounts
    provider.connect();

    const handleStatus = (event: { status: string }) => {
      console.log(`Yjs Connection Status: ${event.status} RoomID: ${roomId}`);
      setConnected(event.status === "connected");
    };

    provider.on("status", handleStatus);

    // Cleanup: disconnect and destroy to prevent memory leaks and ghost connections
    return () => {
      provider.off("status", handleStatus);
      provider.disconnect();
      provider.destroy();
      ydoc.destroy();
    };
  }, [provider, ydoc]);

  return { ydoc, provider, connected };
}

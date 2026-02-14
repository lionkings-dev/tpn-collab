import { useEffect, useMemo, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

type AwarenessUser = {
  name: string;
  color: string;
};

type AwarenessCursor = {
  x: number;
  y: number;
};

type AwarenessState = {
  user?: AwarenessUser;
  cursor?: AwarenessCursor;
};

export type RemoteAwarenessUser = {
  clientId: number;
  user: AwarenessUser;
  cursor?: AwarenessCursor;
};

const AWARENESS_COLORS = [
  "#e11d48",
  "#2563eb",
  "#0f766e",
  "#ca8a04",
  "#7c3aed",
  "#ea580c",
];

function createGuestIdentity() {
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  const color =
    AWARENESS_COLORS[Math.floor(Math.random() * AWARENESS_COLORS.length)];
  return {
    name: `Guest-${suffix}`,
    color,
  } satisfies AwarenessUser;
}

export function useYjsProvider(roomId: string, enabled = true) {
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
    if (!enabled) {
      setConnected(false);
      return;
    }

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
  }, [provider, ydoc, roomId, enabled]);

  return { ydoc, provider, connected };
}

export function useAwareness(roomId: string, provider: WebsocketProvider) {
  const awareness = provider.awareness;
  const [localUser] = useState<AwarenessUser>(() => createGuestIdentity());
  const [remoteUsers, setRemoteUsers] = useState<RemoteAwarenessUser[]>([]);

  useEffect(() => {
    awareness.setLocalStateField("user", localUser);

    const syncRemoteUsers = () => {
      const nextUsers: RemoteAwarenessUser[] = [];

      awareness.getStates().forEach((state, clientId) => {
        if (clientId === awareness.clientID) return;

        const typedState = state as AwarenessState;
        if (!typedState.user) return;

        nextUsers.push({
          clientId,
          user: typedState.user,
          cursor: typedState.cursor,
        });
      });

      setRemoteUsers(nextUsers);
    };

    syncRemoteUsers();
    awareness.on("change", syncRemoteUsers);

    return () => {
      awareness.off("change", syncRemoteUsers);
      awareness.setLocalStateField("cursor", null);
    };
  }, [awareness, roomId, localUser]);

  const updateLocalCursor = (x: number, y: number) => {
    awareness.setLocalStateField("cursor", { x, y } satisfies AwarenessCursor);
  };

  const clearLocalCursor = () => {
    awareness.setLocalStateField("cursor", null);
  };

  return {
    awareness,
    localUser,
    remoteUsers,
    updateLocalCursor,
    clearLocalCursor,
  };
}

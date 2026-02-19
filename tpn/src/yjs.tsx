import { useEffect, useMemo, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

type AwarenessUser = {
  name: string;
  color: string;
};

type AwarenessIdentityInput = {
  id?: string;
  name?: string;
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

function colorFromSeed(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }

  const normalized = Math.abs(hash) % AWARENESS_COLORS.length;
  return AWARENESS_COLORS[normalized];
}

function createIdentityFromAuth(
  identity: AwarenessIdentityInput | null | undefined,
): AwarenessUser | null {
  const name = identity?.name?.trim();
  if (!name) return null;

  const seed = (identity?.id || name).toLowerCase();
  return {
    name,
    color: colorFromSeed(seed),
  };
}

export function useYjsProvider(roomId: string, enabled = true) {
  const [connected, setConnected] = useState(false);

  const ydoc = useMemo(() => new Y.Doc(), [roomId]);
  const wsUrl = useMemo(() => {
    const envUrl = import.meta.env.VITE_WS_URL as string | undefined;
    if (envUrl) {
      try {
        const parsed = new URL(envUrl);
        const isEnvLocalhost =
          parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
        const isRuntimeLocalhost =
          window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1";

        if (isEnvLocalhost && !isRuntimeLocalhost) {
          parsed.hostname = window.location.hostname;
        }

        if (window.location.protocol === "https:" && parsed.protocol === "ws:") {
          parsed.protocol = "wss:";
        }

        return parsed.toString();
      } catch {
        return envUrl;
      }
    }

    return `ws://${window.location.hostname}:1234`;
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
      // provider.destroy();
      // ydoc.destroy();
    };
  }, [provider, ydoc, roomId, enabled]);

  return { ydoc, provider, connected };
}

export function useAwareness(
  roomId: string,
  provider: WebsocketProvider,
  identity?: AwarenessIdentityInput | null,
) {
  const awareness = provider.awareness;
  const [guestIdentity] = useState<AwarenessUser>(() => createGuestIdentity());
  const [remoteUsers, setRemoteUsers] = useState<RemoteAwarenessUser[]>([]);
  const authIdentity = useMemo(() => createIdentityFromAuth(identity), [identity]);
  const localUser = authIdentity || guestIdentity;

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

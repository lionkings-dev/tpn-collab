import { useEffect, useMemo, useState } from "react";
import { WebsocketProvider } from "y-websocket";

import type {
  AwarenessCursor,
  AwarenessIdentityInput,
  AwarenessState,
  AwarenessUser,
  RemoteAwarenessUser,
} from "./types";

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

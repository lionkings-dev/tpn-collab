import { useCallback, useEffect, useMemo, useState } from "react";
import { ROOM_ERROR_CODES } from "@tpn/contracts/error-codes";

import { firebaseAuth } from "../../../lib/firebase";
import {
  checkRoomExists,
  generateRoomName,
  getRoomById,
  isValidRoomId,
  renameOwnedRoom,
} from "../../rooms";

// Extracted from EditorPage (step 3) to centralize room access/metadata behavior.

const ROOM_META_PREFIX = "room-meta:";

type UseEditorRoomAccessParams = {
  roomId?: string;
  routeRoomName?: string;
  onJoinErrorRedirect: (message: string) => void;
};

export type RenameRoomResult = "persisted" | "local_only" | "failed";

function saveRoomNameLocally(roomId: string, name: string) {
  localStorage.setItem(
    `${ROOM_META_PREFIX}${roomId}`,
    JSON.stringify({
      name,
      updatedAt: Date.now(),
    }),
  );
}

export function useEditorRoomAccess({
  roomId,
  routeRoomName,
  onJoinErrorRedirect,
}: UseEditorRoomAccessParams) {
  const activeRoomId = roomId || "default-room";
  const [isRoomAllowed, setIsRoomAllowed] = useState(false);
  const [isCheckingRoom, setIsCheckingRoom] = useState(true);

  const initialRoomName = useMemo(() => {
    const stored = localStorage.getItem(`${ROOM_META_PREFIX}${activeRoomId}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { name?: string };
        if (parsed.name && parsed.name.trim()) return parsed.name;
      } catch {
        // Ignore malformed local storage
      }
    }

    if (routeRoomName && routeRoomName.trim()) {
      return routeRoomName.trim();
    }

    return generateRoomName(activeRoomId);
  }, [activeRoomId, routeRoomName]);

  const [roomName, setRoomName] = useState(initialRoomName);

  useEffect(() => {
    let cancelled = false;

    const verifyRoom = async () => {
      if (!roomId || !isValidRoomId(roomId)) {
        onJoinErrorRedirect("Invalid room ID.");
        return;
      }

      setIsCheckingRoom(true);

      try {
        const exists = await checkRoomExists(roomId);
        if (cancelled) return;

        if (!exists) {
          onJoinErrorRedirect("Room not found. Create a room from landing page.");
          return;
        }

        try {
          const room = await getRoomById(roomId);
          if (cancelled) return;

          setRoomName(room.name);
          saveRoomNameLocally(roomId, room.name);
        } catch {
          if (cancelled) return;
        }

        setIsRoomAllowed(true);
      } catch {
        if (cancelled) return;
        onJoinErrorRedirect("Could not verify room. Please try again.");
      } finally {
        if (!cancelled) {
          setIsCheckingRoom(false);
        }
      }
    };

    setIsRoomAllowed(false);
    void verifyRoom();

    return () => {
      cancelled = true;
    };
  }, [roomId, onJoinErrorRedirect]);

  useEffect(() => {
    setRoomName(initialRoomName);
  }, [initialRoomName]);

  const renameRoom = useCallback(
    async (nextName: string) => {
      const normalizedName = nextName.trim();
      if (!normalizedName) {
        return "failed" as const;
      }

      const currentUser = firebaseAuth.currentUser;
      if (!currentUser) {
        setRoomName(normalizedName);
        saveRoomNameLocally(activeRoomId, normalizedName);
        return "local_only" as const;
      }

      try {
        const idToken = await currentUser.getIdToken();
        await renameOwnedRoom(activeRoomId, normalizedName, idToken);
        setRoomName(normalizedName);
        saveRoomNameLocally(activeRoomId, normalizedName);
        return "persisted" as const;
      } catch (error) {
        const code = error instanceof Error ? error.message : "";
        if (
          code === ROOM_ERROR_CODES.FORBIDDEN_ROOM_OWNER_ONLY ||
          code === ROOM_ERROR_CODES.INVALID_OWNER_ID
        ) {
          setRoomName(normalizedName);
          saveRoomNameLocally(activeRoomId, normalizedName);
          return "local_only" as const;
        }

        return "failed" as const;
      }
    },
    [activeRoomId],
  );

  return {
    activeRoomId,
    roomName,
    isRoomAllowed,
    isCheckingRoom,
    renameRoom,
  };
}

import { resolveApiBaseUrl } from "../../config/network";

export type RegisterRoomOptions = {
  idToken?: string;
  name?: string;
};

export type RegisteredRoomResponse = {
  ok: true;
  roomId: string;
  ownerId: string | null;
  claimToken: string | null;
};

export type OwnedRoom = {
  roomId: string;
  name: string;
  ownerId: string | null;
  visibility: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string;
};

export type ClaimRoomResult = {
  room: OwnedRoom;
  claimStatus: "claimed" | "already_owned_by_you";
};

export async function getRoomById(roomId: string): Promise<OwnedRoom> {
  const response = await fetch(`${getRoomApiBaseUrl()}/api/rooms/${encodeURIComponent(roomId)}`, {
    method: "GET",
  });

  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; room?: OwnedRoom; error?: string }
    | null;

  if (!response.ok || !payload?.ok || !payload.room) {
    const errorCode = payload?.error || `room_load_failed_${response.status}`;
    throw new Error(errorCode);
  }

  return payload.room;
}

export function getRoomApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_ROOM_API_URL as string | undefined;
  return resolveApiBaseUrl(envUrl);
}

export async function checkRoomExists(roomId: string): Promise<boolean> {
  const response = await fetch(
    `${getRoomApiBaseUrl()}/api/rooms/${encodeURIComponent(roomId)}/exists`,
  );

  if (!response.ok) {
    return false;
  }

  const payload = (await response.json()) as { exists?: boolean };
  return payload.exists === true;
}

export async function registerRoom(
  roomId: string,
  options?: RegisterRoomOptions,
): Promise<RegisteredRoomResponse> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (options?.idToken) {
    headers.Authorization = `Bearer ${options.idToken}`;
  }

  const response = await fetch(
    `${getRoomApiBaseUrl()}/api/rooms/${encodeURIComponent(roomId)}/register`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ name: options?.name || "" }),
    },
  );

  if (!response.ok) {
    throw new Error(`room_register_failed_${response.status}`);
  }

  return (await response.json()) as RegisteredRoomResponse;
}

export async function claimRoomOwnership(
  roomId: string,
  idToken: string,
  claimToken: string,
): Promise<ClaimRoomResult> {
  const response = await fetch(
    `${getRoomApiBaseUrl()}/api/rooms/${encodeURIComponent(roomId)}/claim`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ claimToken }),
    },
  );

  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; room?: OwnedRoom; claimStatus?: ClaimRoomResult["claimStatus"]; error?: string }
    | null;

  if (!response.ok || !payload?.ok || !payload.room || !payload.claimStatus) {
    const errorCode = payload?.error || `room_claim_failed_${response.status}`;
    throw new Error(errorCode);
  }

  return {
    room: payload.room,
    claimStatus: payload.claimStatus,
  };
}

export async function getOwnedRooms(idToken: string): Promise<OwnedRoom[]> {
  const response = await fetch(`${getRoomApiBaseUrl()}/api/rooms/mine`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; rooms?: OwnedRoom[]; error?: string }
    | null;

  if (!response.ok || !payload?.ok || !payload.rooms) {
    const errorCode = payload?.error || `owned_rooms_load_failed_${response.status}`;
    throw new Error(errorCode);
  }

  return payload.rooms;
}

export async function renameOwnedRoom(
  roomId: string,
  nextName: string,
  idToken: string,
): Promise<OwnedRoom> {
  const response = await fetch(`${getRoomApiBaseUrl()}/api/rooms/${encodeURIComponent(roomId)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: nextName }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; room?: OwnedRoom; error?: string }
    | null;

  if (!response.ok || !payload?.ok || !payload.room) {
    const errorCode = payload?.error || `room_rename_failed_${response.status}`;
    throw new Error(errorCode);
  }

  return payload.room;
}

export async function deleteOwnedRoom(roomId: string, idToken: string): Promise<void> {
  const response = await fetch(`${getRoomApiBaseUrl()}/api/rooms/${encodeURIComponent(roomId)}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (response.ok) return;

  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  const errorCode = payload?.error || `room_delete_failed_${response.status}`;
  throw new Error(errorCode);
}

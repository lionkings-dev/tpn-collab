import { resolveApiBaseUrl } from "../../config/network";

export type RegisterRoomOptions = {
  idToken?: string;
  name?: string;
};

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
): Promise<void> {
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
}

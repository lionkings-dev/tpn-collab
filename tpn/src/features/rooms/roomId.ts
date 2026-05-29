import { isValidRoomId, normalizeRoomId } from "@tpn/contracts/room-id";

const ROOM_ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const ROOM_ID_LENGTH = 6;

function randomIndex(maxExclusive: number): number {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint32Array(1);
    cryptoApi.getRandomValues(bytes);
    return bytes[0] % maxExclusive;
  }

  return Math.floor(Math.random() * maxExclusive);
}

export function generateRoomId(): string {
  let result = "";
  for (let index = 0; index < ROOM_ID_LENGTH; index += 1) {
    result += ROOM_ID_ALPHABET[randomIndex(ROOM_ID_ALPHABET.length)];
  }
  return result;
}

export function generateRoomName(roomId?: string): string {
  if (roomId && isValidRoomId(roomId)) {
    if (/^[A-Z0-9]{6}$/.test(roomId)) {
      return `Room ${roomId}`;
    }

    return roomId.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  }

  return `Room ${new Date().toLocaleString()}`;
}

export function extractRoomIdFromInvite(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  if (!raw.includes("/") && !raw.includes(":") && !raw.includes(".")) {
    return raw;
  }

  try {
    const parsed = new URL(raw);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const roomIndex = segments.findIndex((segment) => segment === "room");
    if (roomIndex === -1) return null;
    return segments[roomIndex + 1] ?? null;
  } catch {
    return null;
  }
}

export function normalizeRoomInput(input: string): string | null {
  const extracted = extractRoomIdFromInvite(input);
  if (!extracted) return null;
  return normalizeRoomId(extracted);
}

export { isValidRoomId };

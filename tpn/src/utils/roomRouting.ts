const ROOM_ID_REGEX = /^[a-z0-9][a-z0-9-]{5,63}$/;

const ADJECTIVES = [
  "amber",
  "brisk",
  "calm",
  "delta",
  "ember",
  "frost",
  "gold",
  "harbor",
  "indigo",
  "jade",
  "kilo",
  "lunar",
];

const NOUNS = [
  "atlas",
  "beacon",
  "canyon",
  "drift",
  "engine",
  "falcon",
  "grove",
  "harbor",
  "island",
  "jungle",
  "kernel",
  "lantern",
];

function randomFrom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function randomBase36(length: number): string {
  return Math.random().toString(36).slice(2, 2 + length);
}

export function generateRoomId(): string {
  const prefix = `${randomFrom(ADJECTIVES)}-${randomFrom(NOUNS)}`;
  const suffix = randomBase36(6);
  return `${prefix}-${suffix}`;
}

export function generateRoomName(roomId?: string): string {
  if (roomId && isValidRoomId(roomId)) {
    return roomId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return `Room ${new Date().toLocaleString()}`;
}

export function isValidRoomId(roomId: string): boolean {
  return ROOM_ID_REGEX.test(roomId);
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
  return extracted.trim().toLowerCase();
}

export function getRoomApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_ROOM_API_URL as string | undefined;
  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  }

  return `http://${window.location.hostname}:1234`;
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

export async function registerRoom(roomId: string): Promise<void> {
  await fetch(`${getRoomApiBaseUrl()}/api/rooms/${encodeURIComponent(roomId)}/register`, {
    method: "POST",
  });
}

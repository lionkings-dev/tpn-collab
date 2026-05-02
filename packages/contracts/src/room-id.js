const SHORT_ROOM_ID_REGEX = /^[A-Z0-9]{6}$/;
const LEGACY_ROOM_ID_REGEX = /^[a-z0-9][a-z0-9-]{5,63}$/;

export const ROOM_ID_REGEX = /^(?:[A-Z0-9]{6}|[a-z0-9][a-z0-9-]{5,63})$/;

export function normalizeRoomId(value) {
  const raw = value?.trim() || "";
  if (/^[a-z0-9]{6}$/i.test(raw) && !raw.includes("-")) {
    return raw.toUpperCase();
  }

  return raw.toLowerCase();
}

export function isValidRoomId(roomId) {
  if (!roomId) return false;
  return SHORT_ROOM_ID_REGEX.test(roomId) || LEGACY_ROOM_ID_REGEX.test(roomId);
}

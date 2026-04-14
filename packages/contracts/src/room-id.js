export const ROOM_ID_REGEX = /^[a-z0-9][a-z0-9-]{5,63}$/;

export function normalizeRoomId(value) {
  return value?.trim().toLowerCase() || "";
}

export function isValidRoomId(roomId) {
  return ROOM_ID_REGEX.test(roomId);
}

import { normalizeRoomId } from "./roomId.js";

export function resolveRoomIdFromUpgradeUrl(rawUrl) {
  const parsed = new URL(rawUrl || "/", "http://localhost");
  const pathSegments = parsed.pathname.split("/").filter(Boolean);
  const roomSegment = pathSegments.at(-1) || "";
  const roomId = normalizeRoomId(roomSegment);
  return {
    roomId,
    search: parsed.search,
  };
}

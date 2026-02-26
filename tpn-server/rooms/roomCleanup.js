import {
  archiveOwnerlessRoomsByIds,
  findIdleOwnerlessActiveRooms,
} from "./roomsRepo.js";

const DEFAULT_IDLE_DAYS = 30;

function toInteger(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export async function runIdleOwnerlessRoomCleanup({
  idleDays = DEFAULT_IDLE_DAYS,
  dryRun = true,
  limit = 500,
} = {}) {
  const normalizedDays = toInteger(idleDays, DEFAULT_IDLE_DAYS);
  const normalizedLimit = toInteger(limit, 500);
  const cutoff = new Date(Date.now() - normalizedDays * 24 * 60 * 60 * 1000);

  const candidates = await findIdleOwnerlessActiveRooms({
    idleBefore: cutoff,
    limit: normalizedLimit,
  });

  if (dryRun || candidates.length === 0) {
    return {
      dryRun: true,
      idleDays: normalizedDays,
      cutoff,
      candidateCount: candidates.length,
      archivedCount: 0,
      roomIds: candidates.map((room) => room.roomId),
    };
  }

  const roomIds = candidates.map((room) => room.roomId);
  const result = await archiveOwnerlessRoomsByIds(roomIds);

  return {
    dryRun: false,
    idleDays: normalizedDays,
    cutoff,
    candidateCount: candidates.length,
    archivedCount: result.modifiedCount,
    matchedCount: result.matchedCount,
    roomIds,
  };
}

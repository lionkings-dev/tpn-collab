const CLAIM_TOKEN_PREFIX = "room-claim-token:";

function getStorageKey(roomId: string) {
  return `${CLAIM_TOKEN_PREFIX}${roomId}`;
}

export function saveRoomClaimToken(roomId: string, claimToken: string) {
  localStorage.setItem(getStorageKey(roomId), claimToken);
}

export function getRoomClaimToken(roomId: string): string | null {
  return localStorage.getItem(getStorageKey(roomId));
}

export function clearRoomClaimToken(roomId: string) {
  localStorage.removeItem(getStorageKey(roomId));
}

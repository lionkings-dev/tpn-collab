export declare const ROOM_VISIBILITY: {
  readonly PRIVATE: "private";
};

export declare const ROOM_STATUS: {
  readonly ACTIVE: "active";
  readonly ARCHIVED: "archived";
};

export declare const CLAIM_ROOM_STATUS: {
  readonly CLAIMED: "claimed";
  readonly ALREADY_OWNED_BY_YOU: "already_owned_by_you";
};

export type RoomVisibility =
  (typeof ROOM_VISIBILITY)[keyof typeof ROOM_VISIBILITY];

export type RoomStatus = (typeof ROOM_STATUS)[keyof typeof ROOM_STATUS];

export type ClaimRoomStatus =
  (typeof CLAIM_ROOM_STATUS)[keyof typeof CLAIM_ROOM_STATUS];

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
  visibility: RoomVisibility;
  status: RoomStatus;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string;
};

export type ClaimRoomResult = {
  room: OwnedRoom;
  claimStatus: ClaimRoomStatus;
};

export type PublicRoomSummary = {
  name: string;
};

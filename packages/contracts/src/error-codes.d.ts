export declare const ROOM_ERROR_CODES: {
  readonly INVALID_ROOM_ID: "invalid_room_id";
  readonly ROOM_NOT_FOUND: "room_not_found";
  readonly INVALID_OWNER_ID: "invalid_owner_id";
  readonly FORBIDDEN_ROOM_OWNER_ONLY: "forbidden_room_owner_only";
  readonly CLAIM_TOKEN_INVALID_OR_MISSING: "claim_token_invalid_or_missing";
  readonly ROOM_ALREADY_CLAIMED: "room_already_claimed";
  readonly INVALID_ROOM_NAME: "invalid_room_name";
  readonly ROOM_LOOKUP_FAILED: "room_lookup_failed";
  readonly ROOM_ID_COLLISION: "room_id_collision";
  readonly ROOM_REGISTER_FAILED: "room_register_failed";
  readonly ROOM_LOAD_FAILED: "room_load_failed";
  readonly ROOM_RENAME_FAILED: "room_rename_failed";
  readonly ROOM_ARCHIVE_FAILED: "room_archive_failed";
  readonly ROOM_CLAIM_FAILED: "room_claim_failed";
  readonly OWNED_ROOMS_LOAD_FAILED: "owned_rooms_load_failed";
  readonly ROOM_ADMISSION_FAILED: "room_admission_failed";
  readonly DB_NOT_CONFIGURED: "db_not_configured";
};

export type RoomErrorCode =
  (typeof ROOM_ERROR_CODES)[keyof typeof ROOM_ERROR_CODES];

export declare const AUTH_ERROR_CODES: {
  readonly AUTH_NOT_CONFIGURED: "auth_not_configured";
  readonly MISSING_BEARER_TOKEN: "missing_bearer_token";
  readonly INVALID_OR_EXPIRED_TOKEN: "invalid_or_expired_token";
  readonly DB_NOT_CONFIGURED: "db_not_configured";
};

export type AuthErrorCode =
  (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];

export const ROOM_ERROR_CODES = Object.freeze({
  INVALID_ROOM_ID: "invalid_room_id",
  ROOM_NOT_FOUND: "room_not_found",
  INVALID_OWNER_ID: "invalid_owner_id",
  FORBIDDEN_ROOM_OWNER_ONLY: "forbidden_room_owner_only",
  CLAIM_TOKEN_INVALID_OR_MISSING: "claim_token_invalid_or_missing",
  ROOM_ALREADY_CLAIMED: "room_already_claimed",
  INVALID_ROOM_NAME: "invalid_room_name",
  ROOM_LOOKUP_FAILED: "room_lookup_failed",
  ROOM_ID_COLLISION: "room_id_collision",
  ROOM_REGISTER_FAILED: "room_register_failed",
  ROOM_LOAD_FAILED: "room_load_failed",
  ROOM_RENAME_FAILED: "room_rename_failed",
  ROOM_ARCHIVE_FAILED: "room_archive_failed",
  ROOM_CLAIM_FAILED: "room_claim_failed",
  OWNED_ROOMS_LOAD_FAILED: "owned_rooms_load_failed",
  ROOM_ADMISSION_FAILED: "room_admission_failed",
  DB_NOT_CONFIGURED: "db_not_configured",
});

export const AUTH_ERROR_CODES = Object.freeze({
  AUTH_NOT_CONFIGURED: "auth_not_configured",
  MISSING_BEARER_TOKEN: "missing_bearer_token",
  INVALID_OR_EXPIRED_TOKEN: "invalid_or_expired_token",
  DB_NOT_CONFIGURED: "db_not_configured",
});

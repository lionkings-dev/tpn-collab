import { Router } from "express";
import { ROOM_ERROR_CODES } from "@tpn/contracts/error-codes";

import { attachAuthIfPresent } from "../auth/attachAuthIfPresent.js";
import { requireAuth } from "../auth/requireAuth.js";
import {
  archiveOwnedRoom,
  claimRoomOwnership,
  getOwnedRoomById,
  getPublicRoomById,
  getOwnedRooms,
  registerRoom,
  renameOwnedRoom,
  roomExists,
} from "../rooms/roomsRepo.js";
import { isValidRoomId, normalizeRoomId } from "../utils/roomId.js";

const roomRoutes = Router();

roomRoutes.get("/:roomId/exists", async (req, res) => {
  const roomId = normalizeRoomId(req.params.roomId);

  if (!roomId || !isValidRoomId(roomId)) {
    res.status(400).json({ exists: false, error: ROOM_ERROR_CODES.INVALID_ROOM_ID });
    return;
  }

  try {
    const exists = await roomExists(roomId);

    res.json({
      exists,
      roomId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Room lookup failed.";
    if (message.includes("MONGODB_URI is required")) {
      res.status(503).json({ exists: false, error: ROOM_ERROR_CODES.DB_NOT_CONFIGURED });
      return;
    }

    if (message.includes("rooms_index_validation_failed")) {
      res.status(500).json({ exists: false, error: "rooms_index_invalid" });
      return;
    }

    res.status(500).json({ exists: false, error: ROOM_ERROR_CODES.ROOM_LOOKUP_FAILED });
  }
});

roomRoutes.post("/:roomId/register", attachAuthIfPresent, async (req, res) => {
  const roomId = normalizeRoomId(req.params.roomId);

  if (!roomId || !isValidRoomId(roomId)) {
    res.status(400).json({ ok: false, error: ROOM_ERROR_CODES.INVALID_ROOM_ID });
    return;
  }

  try {
    const roomName = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const room = await registerRoom({
      roomId,
      roomName,
      ownerId: req.user?.id || null,
    });

    res.status(201).json({
      ok: true,
      roomId: room.roomId,
      ownerId: room.ownerId,
      claimToken: room.claimToken || null,
    });
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : null;

    if (code === ROOM_ERROR_CODES.ROOM_ID_COLLISION) {
      res.status(409).json({ ok: false, error: code });
      return;
    }

    const message = error instanceof Error ? error.message : "Room register failed.";
    if (message.includes("MONGODB_URI is required")) {
      res.status(503).json({ ok: false, error: ROOM_ERROR_CODES.DB_NOT_CONFIGURED });
      return;
    }

    if (message.includes("rooms_index_validation_failed")) {
      res.status(500).json({ ok: false, error: "rooms_index_invalid" });
      return;
    }

    res.status(500).json({ ok: false, error: ROOM_ERROR_CODES.ROOM_REGISTER_FAILED });
  }
});

roomRoutes.post("/:roomId/claim", requireAuth, async (req, res) => {
  const roomId = normalizeRoomId(req.params.roomId);

  if (!roomId || !isValidRoomId(roomId)) {
    res.status(400).json({ ok: false, error: ROOM_ERROR_CODES.INVALID_ROOM_ID });
    return;
  }

  const claimToken = typeof req.body?.claimToken === "string" ? req.body.claimToken : "";

  try {
    const result = await claimRoomOwnership({
      roomId,
      ownerId: req.user.id,
      claimToken,
    });

    res.json({
      ok: true,
      room: result.room,
      claimStatus: result.claimStatus,
    });
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : null;

    if (code === ROOM_ERROR_CODES.ROOM_NOT_FOUND) {
      res.status(404).json({ ok: false, error: code });
      return;
    }

    if (code === ROOM_ERROR_CODES.ROOM_ALREADY_CLAIMED) {
      res.status(409).json({ ok: false, error: code });
      return;
    }

    if (
      code === ROOM_ERROR_CODES.CLAIM_TOKEN_INVALID_OR_MISSING ||
      code === ROOM_ERROR_CODES.INVALID_OWNER_ID
    ) {
      res.status(400).json({ ok: false, error: code });
      return;
    }

    const message = error instanceof Error ? error.message : "Room claim failed.";
    if (message.includes("MONGODB_URI is required")) {
      res.status(503).json({ ok: false, error: ROOM_ERROR_CODES.DB_NOT_CONFIGURED });
      return;
    }

    res.status(500).json({ ok: false, error: ROOM_ERROR_CODES.ROOM_CLAIM_FAILED });
  }
});

roomRoutes.get("/mine", requireAuth, async (req, res) => {
  try {
    const rooms = await getOwnedRooms(req.user.id);
    res.json({ ok: true, rooms });
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : null;
    if (code === ROOM_ERROR_CODES.INVALID_OWNER_ID) {
      res.status(400).json({ ok: false, error: code });
      return;
    }

    const message = error instanceof Error ? error.message : "Load owned rooms failed.";
    if (message.includes("MONGODB_URI is required")) {
      res.status(503).json({ ok: false, error: ROOM_ERROR_CODES.DB_NOT_CONFIGURED });
      return;
    }

    res.status(500).json({ ok: false, error: ROOM_ERROR_CODES.OWNED_ROOMS_LOAD_FAILED });
  }
});

roomRoutes.get("/:roomId/private", requireAuth, async (req, res) => {
  const roomId = normalizeRoomId(req.params.roomId);

  if (!roomId || !isValidRoomId(roomId)) {
    res.status(400).json({ ok: false, error: ROOM_ERROR_CODES.INVALID_ROOM_ID });
    return;
  }

  try {
    const room = await getOwnedRoomById({
      roomId,
      ownerId: req.user.id,
    });
    res.json({ ok: true, room });
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : null;
    if (code === ROOM_ERROR_CODES.ROOM_NOT_FOUND) {
      res.status(404).json({ ok: false, error: code });
      return;
    }
    if (code === ROOM_ERROR_CODES.FORBIDDEN_ROOM_OWNER_ONLY) {
      res.status(403).json({ ok: false, error: code });
      return;
    }
    if (code === ROOM_ERROR_CODES.INVALID_OWNER_ID) {
      res.status(400).json({ ok: false, error: code });
      return;
    }

    const message = error instanceof Error ? error.message : "Room load failed.";
    if (message.includes("MONGODB_URI is required")) {
      res.status(503).json({ ok: false, error: ROOM_ERROR_CODES.DB_NOT_CONFIGURED });
      return;
    }

    res.status(500).json({ ok: false, error: ROOM_ERROR_CODES.ROOM_LOAD_FAILED });
  }
});

roomRoutes.get("/:roomId", async (req, res) => {
  const roomId = normalizeRoomId(req.params.roomId);

  if (!roomId || !isValidRoomId(roomId)) {
    res.status(400).json({ ok: false, error: ROOM_ERROR_CODES.INVALID_ROOM_ID });
    return;
  }

  try {
    const room = await getPublicRoomById(roomId);
    res.json({ ok: true, room });
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : null;
    if (code === ROOM_ERROR_CODES.ROOM_NOT_FOUND) {
      res.status(404).json({ ok: false, error: code });
      return;
    }

    const message = error instanceof Error ? error.message : "Room load failed.";
    if (message.includes("MONGODB_URI is required")) {
      res.status(503).json({ ok: false, error: ROOM_ERROR_CODES.DB_NOT_CONFIGURED });
      return;
    }

    res.status(500).json({ ok: false, error: ROOM_ERROR_CODES.ROOM_LOAD_FAILED });
  }
});

roomRoutes.patch("/:roomId", requireAuth, async (req, res) => {
  const roomId = normalizeRoomId(req.params.roomId);

  if (!roomId || !isValidRoomId(roomId)) {
    res.status(400).json({ ok: false, error: ROOM_ERROR_CODES.INVALID_ROOM_ID });
    return;
  }

  const roomName = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!roomName) {
    res.status(400).json({ ok: false, error: ROOM_ERROR_CODES.INVALID_ROOM_NAME });
    return;
  }

  try {
    const room = await renameOwnedRoom({
      roomId,
      ownerId: req.user.id,
      name: roomName,
    });
    res.json({ ok: true, room });
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : null;
    if (code === ROOM_ERROR_CODES.ROOM_NOT_FOUND) {
      res.status(404).json({ ok: false, error: code });
      return;
    }
    if (code === ROOM_ERROR_CODES.FORBIDDEN_ROOM_OWNER_ONLY) {
      res.status(403).json({ ok: false, error: code });
      return;
    }
    if (code === ROOM_ERROR_CODES.INVALID_OWNER_ID) {
      res.status(400).json({ ok: false, error: code });
      return;
    }

    const message = error instanceof Error ? error.message : "Room rename failed.";
    if (message.includes("MONGODB_URI is required")) {
      res.status(503).json({ ok: false, error: ROOM_ERROR_CODES.DB_NOT_CONFIGURED });
      return;
    }

    res.status(500).json({ ok: false, error: ROOM_ERROR_CODES.ROOM_RENAME_FAILED });
  }
});

roomRoutes.delete("/:roomId", requireAuth, async (req, res) => {
  const roomId = normalizeRoomId(req.params.roomId);

  if (!roomId || !isValidRoomId(roomId)) {
    res.status(400).json({ ok: false, error: ROOM_ERROR_CODES.INVALID_ROOM_ID });
    return;
  }

  try {
    await archiveOwnedRoom({
      roomId,
      ownerId: req.user.id,
    });
    res.json({ ok: true, roomId });
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : null;
    if (code === ROOM_ERROR_CODES.ROOM_NOT_FOUND) {
      res.status(404).json({ ok: false, error: code });
      return;
    }
    if (code === ROOM_ERROR_CODES.FORBIDDEN_ROOM_OWNER_ONLY) {
      res.status(403).json({ ok: false, error: code });
      return;
    }
    if (code === ROOM_ERROR_CODES.INVALID_OWNER_ID) {
      res.status(400).json({ ok: false, error: code });
      return;
    }

    const message = error instanceof Error ? error.message : "Room archive failed.";
    if (message.includes("MONGODB_URI is required")) {
      res.status(503).json({ ok: false, error: ROOM_ERROR_CODES.DB_NOT_CONFIGURED });
      return;
    }

    res.status(500).json({ ok: false, error: ROOM_ERROR_CODES.ROOM_ARCHIVE_FAILED });
  }
});

export default roomRoutes;

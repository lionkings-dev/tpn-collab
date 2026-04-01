import { Router } from "express";

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
    res.status(400).json({ exists: false, error: "invalid_room_id" });
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
      res.status(503).json({ exists: false, error: "db_not_configured" });
      return;
    }

    if (message.includes("rooms_index_validation_failed")) {
      res.status(500).json({ exists: false, error: "rooms_index_invalid" });
      return;
    }

    res.status(500).json({ exists: false, error: "room_lookup_failed" });
  }
});

roomRoutes.post("/:roomId/register", attachAuthIfPresent, async (req, res) => {
  const roomId = normalizeRoomId(req.params.roomId);

  if (!roomId || !isValidRoomId(roomId)) {
    res.status(400).json({ ok: false, error: "invalid_room_id" });
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
    const message = error instanceof Error ? error.message : "Room register failed.";
    if (message.includes("MONGODB_URI is required")) {
      res.status(503).json({ ok: false, error: "db_not_configured" });
      return;
    }

    if (message.includes("rooms_index_validation_failed")) {
      res.status(500).json({ ok: false, error: "rooms_index_invalid" });
      return;
    }

    res.status(500).json({ ok: false, error: "room_register_failed" });
  }
});

roomRoutes.post("/:roomId/claim", requireAuth, async (req, res) => {
  const roomId = normalizeRoomId(req.params.roomId);

  if (!roomId || !isValidRoomId(roomId)) {
    res.status(400).json({ ok: false, error: "invalid_room_id" });
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

    if (code === "room_not_found") {
      res.status(404).json({ ok: false, error: code });
      return;
    }

    if (code === "room_already_claimed") {
      res.status(409).json({ ok: false, error: code });
      return;
    }

    if (code === "claim_token_invalid_or_missing" || code === "invalid_owner_id") {
      res.status(400).json({ ok: false, error: code });
      return;
    }

    const message = error instanceof Error ? error.message : "Room claim failed.";
    if (message.includes("MONGODB_URI is required")) {
      res.status(503).json({ ok: false, error: "db_not_configured" });
      return;
    }

    res.status(500).json({ ok: false, error: "room_claim_failed" });
  }
});

roomRoutes.get("/mine", requireAuth, async (req, res) => {
  try {
    const rooms = await getOwnedRooms(req.user.id);
    res.json({ ok: true, rooms });
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : null;
    if (code === "invalid_owner_id") {
      res.status(400).json({ ok: false, error: code });
      return;
    }

    const message = error instanceof Error ? error.message : "Load owned rooms failed.";
    if (message.includes("MONGODB_URI is required")) {
      res.status(503).json({ ok: false, error: "db_not_configured" });
      return;
    }

    res.status(500).json({ ok: false, error: "owned_rooms_load_failed" });
  }
});

roomRoutes.get("/:roomId/private", requireAuth, async (req, res) => {
  const roomId = normalizeRoomId(req.params.roomId);

  if (!roomId || !isValidRoomId(roomId)) {
    res.status(400).json({ ok: false, error: "invalid_room_id" });
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
    if (code === "room_not_found") {
      res.status(404).json({ ok: false, error: code });
      return;
    }
    if (code === "forbidden_room_owner_only") {
      res.status(403).json({ ok: false, error: code });
      return;
    }
    if (code === "invalid_owner_id") {
      res.status(400).json({ ok: false, error: code });
      return;
    }

    const message = error instanceof Error ? error.message : "Room load failed.";
    if (message.includes("MONGODB_URI is required")) {
      res.status(503).json({ ok: false, error: "db_not_configured" });
      return;
    }

    res.status(500).json({ ok: false, error: "room_load_failed" });
  }
});

roomRoutes.get("/:roomId", async (req, res) => {
  const roomId = normalizeRoomId(req.params.roomId);

  if (!roomId || !isValidRoomId(roomId)) {
    res.status(400).json({ ok: false, error: "invalid_room_id" });
    return;
  }

  try {
    const room = await getPublicRoomById(roomId);
    res.json({ ok: true, room });
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : null;
    if (code === "room_not_found") {
      res.status(404).json({ ok: false, error: code });
      return;
    }

    const message = error instanceof Error ? error.message : "Room load failed.";
    if (message.includes("MONGODB_URI is required")) {
      res.status(503).json({ ok: false, error: "db_not_configured" });
      return;
    }

    res.status(500).json({ ok: false, error: "room_load_failed" });
  }
});

roomRoutes.patch("/:roomId", requireAuth, async (req, res) => {
  const roomId = normalizeRoomId(req.params.roomId);

  if (!roomId || !isValidRoomId(roomId)) {
    res.status(400).json({ ok: false, error: "invalid_room_id" });
    return;
  }

  const roomName = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!roomName) {
    res.status(400).json({ ok: false, error: "invalid_room_name" });
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
    if (code === "room_not_found") {
      res.status(404).json({ ok: false, error: code });
      return;
    }
    if (code === "forbidden_room_owner_only") {
      res.status(403).json({ ok: false, error: code });
      return;
    }
    if (code === "invalid_owner_id") {
      res.status(400).json({ ok: false, error: code });
      return;
    }

    const message = error instanceof Error ? error.message : "Room rename failed.";
    if (message.includes("MONGODB_URI is required")) {
      res.status(503).json({ ok: false, error: "db_not_configured" });
      return;
    }

    res.status(500).json({ ok: false, error: "room_rename_failed" });
  }
});

roomRoutes.delete("/:roomId", requireAuth, async (req, res) => {
  const roomId = normalizeRoomId(req.params.roomId);

  if (!roomId || !isValidRoomId(roomId)) {
    res.status(400).json({ ok: false, error: "invalid_room_id" });
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
    if (code === "room_not_found") {
      res.status(404).json({ ok: false, error: code });
      return;
    }
    if (code === "forbidden_room_owner_only") {
      res.status(403).json({ ok: false, error: code });
      return;
    }
    if (code === "invalid_owner_id") {
      res.status(400).json({ ok: false, error: code });
      return;
    }

    const message = error instanceof Error ? error.message : "Room archive failed.";
    if (message.includes("MONGODB_URI is required")) {
      res.status(503).json({ ok: false, error: "db_not_configured" });
      return;
    }

    res.status(500).json({ ok: false, error: "room_archive_failed" });
  }
});

export default roomRoutes;

import { Router } from "express";

import { attachAuthIfPresent } from "../auth/attachAuthIfPresent.js";
import { registerRoom, roomExists } from "../rooms/roomsRepo.js";
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

export default roomRoutes;

import "dotenv/config";
import { setupWSConnection } from "@y/websocket-server/utils";
import express from "express";
import { createServer } from "http";
import ws, { WebSocketServer } from "ws";
import { attachAuthIfPresent } from "./auth/attachAuthIfPresent.js";
import { requireAuth } from "./auth/requireAuth.js";
import { registerRoom, roomExists } from "./rooms/roomsRepo.js";

const port = process.env.PORT || 1234;
const app = express();
const ROOM_ID_REGEX = /^[a-z0-9][a-z0-9-]{5,63}$/;
const defaultCorsOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
const corsOrigins = (process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
  : defaultCorsOrigins
).filter(Boolean);

function isValidRoomId(roomId) {
  return ROOM_ID_REGEX.test(roomId);
}

app.use(express.json());

app.use((req, res, next) => {
  const requestOrigin = req.headers.origin;

  if (requestOrigin && corsOrigins.includes(requestOrigin)) {
    res.setHeader("Access-Control-Allow-Origin", requestOrigin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
});

app.get("/", (req, res) => {
  res.send("Yjs TPN Server is running");
});

app.get("/api/me", requireAuth, (req, res) => {
  res.json({
    ok: true,
    user: req.user,
  });
});

app.get("/api/rooms/:roomId/exists", async (req, res) => {
  const roomId = req.params.roomId?.trim().toLowerCase();

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

    res.status(500).json({ exists: false, error: "room_lookup_failed" });
  }
});

app.post("/api/rooms/:roomId/register", attachAuthIfPresent, async (req, res) => {
  const roomId = req.params.roomId?.trim().toLowerCase();

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

    res.status(500).json({ ok: false, error: "room_register_failed" });
  }
});

const server = createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  setupWSConnection(ws, req);
  console.log("WS Connection Established");

  ws.on("close", () => {
    console.log("WS Connection Closed");
  });
});

server.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});

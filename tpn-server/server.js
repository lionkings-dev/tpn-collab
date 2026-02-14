import { setupWSConnection } from "@y/websocket-server/utils";
import express from "express";
import { createServer } from "http";
import ws, { WebSocketServer } from "ws";

const port = process.env.PORT || 1234;
const app = express();
const ROOM_ID_REGEX = /^[a-z0-9][a-z0-9-]{5,63}$/;
const knownRooms = new Set();

function isValidRoomId(roomId) {
  return ROOM_ID_REGEX.test(roomId);
}

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
});

app.get("/", (req, res) => {
  res.send("Yjs TPN Server is running");
});

app.get("/api/rooms/:roomId/exists", (req, res) => {
  const roomId = req.params.roomId?.trim().toLowerCase();

  if (!roomId || !isValidRoomId(roomId)) {
    res.status(400).json({ exists: false, error: "invalid_room_id" });
    return;
  }

  res.json({
    exists: knownRooms.has(roomId),
    roomId,
  });
});

app.post("/api/rooms/:roomId/register", (req, res) => {
  const roomId = req.params.roomId?.trim().toLowerCase();

  if (!roomId || !isValidRoomId(roomId)) {
    res.status(400).json({ ok: false, error: "invalid_room_id" });
    return;
  }

  knownRooms.add(roomId);
  res.status(201).json({ ok: true, roomId });
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

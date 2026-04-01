import "dotenv/config";
import { setupWSConnection } from "@y/websocket-server/utils";
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";

import { initializeYjsPersistence } from "./collab/yjsPersistence.js";
import { corsMiddleware } from "./middleware/cors.js";
import {
  initializeRoomsStorage,
  roomExists,
} from "./rooms/roomsRepo.js";
import authRoutes from "./routes/authRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";
import roomRoutes from "./routes/roomRoutes.js";
import { isValidRoomId, normalizeRoomId } from "./utils/roomId.js";

const port = process.env.PORT || 1234;
const app = express();

app.use(express.json());
app.use(corsMiddleware);

app.use(healthRoutes);
app.use("/api", authRoutes);
app.use("/api/rooms", roomRoutes);

const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

function rejectUpgrade(socket, statusCode, reason) {
  socket.write(
    `HTTP/1.1 ${statusCode} ${reason}\r\nConnection: close\r\nContent-Type: text/plain\r\n\r\n${reason}`,
  );
  socket.destroy();
}

function resolveRoomIdFromUpgradeUrl(rawUrl) {
  const parsed = new URL(rawUrl || "/", "http://localhost");
  const pathSegments = parsed.pathname.split("/").filter(Boolean);
  const roomSegment = pathSegments.at(-1) || "";
  const roomId = normalizeRoomId(roomSegment);
  return {
    roomId,
    search: parsed.search,
  };
}

server.on("upgrade", async (req, socket, head) => {
  const { roomId, search } = resolveRoomIdFromUpgradeUrl(req.url);

  if (!roomId || !isValidRoomId(roomId)) {
    rejectUpgrade(socket, 400, "invalid_room_id");
    return;
  }

  try {
    const exists = await roomExists(roomId);
    if (!exists) {
      rejectUpgrade(socket, 404, "room_not_found");
      return;
    }

    req.url = `/${roomId}${search}`;

    wss.handleUpgrade(req, socket, head, (ws) => {
      setupWSConnection(ws, req);
      console.log("WS Connection Established", { roomId });

      ws.on("close", () => {
        console.log("WS Connection Closed", { roomId });
      });
    });
  } catch (error) {
    console.error("WebSocket room admission failed", {
      roomId,
      error: error instanceof Error ? error.message : String(error),
    });
    rejectUpgrade(socket, 503, "room_admission_failed");
  }
});

async function startServer() {
  try {
    await initializeYjsPersistence();
    await initializeRoomsStorage();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown startup error";
    console.error("Failed to initialize room storage", message);
    process.exit(1);
  }

  server.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
  });
}

void startServer();

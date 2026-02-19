import "dotenv/config";
import { setupWSConnection } from "@y/websocket-server/utils";
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";

import { corsMiddleware } from "./middleware/cors.js";
import { initializeRoomsStorage } from "./rooms/roomsRepo.js";
import authRoutes from "./routes/authRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";
import roomRoutes from "./routes/roomRoutes.js";

const port = process.env.PORT || 1234;
const app = express();

app.use(express.json());
app.use(corsMiddleware);

app.use(healthRoutes);
app.use("/api", authRoutes);
app.use("/api/rooms", roomRoutes);

const server = createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  setupWSConnection(ws, req);
  console.log("WS Connection Established");

  ws.on("close", () => {
    console.log("WS Connection Closed");
  });
});

async function startServer() {
  try {
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

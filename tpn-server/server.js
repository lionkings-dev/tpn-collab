import { setupWSConnection } from "@y/websocket-server/utils";
import express from "express";
import { createServer } from "http";
import ws, { WebSocketServer } from "ws";

const port = process.env.PORT || 1234;
const app = express();

app.get("/", (req, res) => {
  res.send("Yjs TPN Server is running");
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

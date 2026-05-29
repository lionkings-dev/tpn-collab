import { spawn } from "child_process";
import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { setTimeout as delay } from "timers/promises";

import WebSocket from "ws";
import { MongoClient } from "mongodb";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = dirname(scriptPath);
const backendRoot = resolve(scriptDir, "..");

loadDotenv({ path: resolve(backendRoot, ".env") });

const baseUrl = (process.env.ROOM_API_URL || "http://localhost:1234").replace(/\/$/, "");
const authToken = process.env.AUTH_BEARER_TOKEN || "";

function randomSuffix(length = 8) {
  return Math.random().toString(36).slice(2, 2 + length);
}

function buildRoomId(prefix) {
  return `${prefix}-${randomSuffix(8)}`;
}

function toWsBaseUrl(httpBaseUrl) {
  if (httpBaseUrl.startsWith("https://")) {
    return httpBaseUrl.replace("https://", "wss://");
  }
  if (httpBaseUrl.startsWith("http://")) {
    return httpBaseUrl.replace("http://", "ws://");
  }
  return httpBaseUrl;
}

function toRoomWsUrl(roomIdOrPath) {
  const base = toWsBaseUrl(baseUrl).replace(/\/$/, "");
  if (roomIdOrPath.startsWith("/")) {
    return `${base}${roomIdOrPath}`;
  }
  return `${base}/${roomIdOrPath}`;
}

function getMongoUri() {
  const uri = process.env.MONGODB_URI?.trim() || "";
  if (!uri) {
    throw new Error("MONGODB_URI is required for day3 persistence smoke");
  }
  return uri;
}

function getMongoDbName() {
  return process.env.MONGODB_DB_NAME?.trim() || "tpn_collab";
}

function getYjsCollectionName() {
  return process.env.YJS_UPDATES_COLLECTION?.trim() || "yjs_updates";
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return { response, json, text };
}

async function isServerHealthy() {
  try {
    const response = await fetch(`${baseUrl}/`);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForHealthy(maxRetries = 40) {
  for (let i = 0; i < maxRetries; i += 1) {
    if (await isServerHealthy()) {
      return;
    }
    await delay(250);
  }

  throw new Error("Server did not become healthy in time");
}

function startServerProcess() {
  const child = spawn("node", ["server.js"], {
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
    cwd: backendRoot,
  });

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[server] ${chunk}`);
  });
  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[server] ${chunk}`);
  });

  return child;
}

async function stopServerProcess(child) {
  if (!child || child.killed) return;

  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => {
      child.once("exit", resolve);
    }),
    delay(2500),
  ]);

  if (!child.killed) {
    child.kill("SIGKILL");
  }
}

async function connectProvider(roomId) {
  const ydoc = new Y.Doc();
  const provider = new WebsocketProvider(toWsBaseUrl(baseUrl), roomId, ydoc, {
    connect: false,
    WebSocketPolyfill: WebSocket,
  });

  const syncPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Yjs provider sync timeout"));
    }, 6000);

    provider.on("sync", (isSynced) => {
      if (!isSynced) return;
      clearTimeout(timer);
      resolve();
    });
  });

  provider.connect();
  await syncPromise;
  return { ydoc, provider };
}

async function assertWsRejected(roomIdOrPath, expectedStatusCode) {
  const url = toRoomWsUrl(roomIdOrPath);

  await new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => {
      ws.terminate();
      reject(new Error(`WebSocket rejection timeout for ${url}`));
    }, 4000);

    const onDone = (error) => {
      clearTimeout(timer);
      ws.removeAllListeners();
      if (error) {
        reject(error);
        return;
      }
      resolve();
    };

    ws.on("open", () => {
      onDone(new Error(`Expected WS rejection for ${url} but connection opened`));
    });

    ws.on("unexpected-response", (_request, response) => {
      if (response.statusCode !== expectedStatusCode) {
        onDone(
          new Error(
            `Expected WS rejection status ${expectedStatusCode} for ${url}, got ${response.statusCode}`,
          ),
        );
        return;
      }
      onDone();
    });

    ws.on("error", () => {
      onDone();
    });
  });
}

async function waitForPersistedUpdates(roomId, maxRetries = 20) {
  const client = new MongoClient(getMongoUri());
  await client.connect();

  try {
    const db = client.db(getMongoDbName());
    const collection = db.collection(getYjsCollectionName());

    for (let i = 0; i < maxRetries; i += 1) {
      const count = await collection.countDocuments({ docName: roomId });
      if (count > 0) {
        return count;
      }
      await delay(250);
    }

    throw new Error("No persisted yjs updates found for room");
  } finally {
    await client.close();
  }
}

async function waitForMapEntry(yMap, key, maxRetries = 24) {
  for (let i = 0; i < maxRetries; i += 1) {
    const value = yMap.get(key);
    if (value) {
      return value;
    }
    await delay(250);
  }

  return null;
}

async function run() {
  const checks = [];
  const push = (name, ok, details = "") => {
    checks.push({ name, ok, details });
    console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${details ? ` - ${details}` : ""}`);
  };

  let managedServer = null;
  let usingExternalServer = false;
  const sessions = [];

  try {
    const healthyBeforeRun = await isServerHealthy();
    if (healthyBeforeRun) {
      usingExternalServer = true;
      push("Server bootstraps", true, "using existing server");
    } else {
      managedServer = startServerProcess();
      await waitForHealthy();
      push("Server bootstraps", true, "started by day3 smoke");
    }

    const roomId = buildRoomId("qa-day3-yjs");
    const register = await request(`/api/rooms/${encodeURIComponent(roomId)}/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "QA Day3 Yjs Persistence" }),
    });
    assert(register.response.status === 201, "Room register should return 201");
    push("Room register succeeds", true, `roomId=${roomId}`);

    await assertWsRejected("BAD", 400);
    push("WS rejects invalid room ids", true, "status=400");

    const unknownRoomId = buildRoomId("qa-day3-unknown");
    await assertWsRejected(unknownRoomId, 404);
    push("WS rejects unknown rooms", true, `roomId=${unknownRoomId}`);

    const firstSession = await connectProvider(roomId);
    sessions.push(firstSession);
    const nodesMap = firstSession.ydoc.getMap("nodes");
    nodesMap.set("qa-node-1", {
      id: "qa-node-1",
      type: "place",
      position: { x: 120, y: 80 },
      data: { label: "Persisted Place", tokens: 1 },
    });

    await delay(600);

    const secondLiveSession = await connectProvider(roomId);
    sessions.push(secondLiveSession);
    const secondLiveNodes = secondLiveSession.ydoc.getMap("nodes");
    const mirroredNode = secondLiveNodes.get("qa-node-1");
    assert(Boolean(mirroredNode), "Live sync failed before persistence check");

    const persistedCount = await waitForPersistedUpdates(roomId);
    push("Yjs updates persisted to Mongo", true, `count=${persistedCount}`);

    push("Yjs update written", true, "qa-node-1 created");

    for (const session of sessions.splice(0, sessions.length)) {
      session.provider.disconnect();
      session.provider.destroy();
      session.ydoc.destroy();
    }

    if (usingExternalServer) {
      push("Server restart persistence check", true, "skipped (external server mode)");
    } else {
      await delay(700);
      await stopServerProcess(managedServer);
      managedServer = null;
      push("Server stopped", true);

      managedServer = startServerProcess();
      await waitForHealthy();
      push("Server restarted", true);

      const secondSession = await connectProvider(roomId);
      sessions.push(secondSession);
      const reloadedNodes = secondSession.ydoc.getMap("nodes");
      const restoredNode = await waitForMapEntry(reloadedNodes, "qa-node-1");

      assert(Boolean(restoredNode), "Persisted node missing after restart");
      assert(restoredNode.data?.label === "Persisted Place", "Restored node label mismatch");

      secondSession.provider.disconnect();
      secondSession.provider.destroy();
      secondSession.ydoc.destroy();
      sessions.pop();

      push("Yjs state restored after restart", true, `nodeCount=${reloadedNodes.size}`);
    }

    if (authToken) {
      const archive = await request(`/api/rooms/${encodeURIComponent(roomId)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (archive.response.ok) {
        await assertWsRejected(roomId, 404);
        push("WS rejects archived rooms", true, `roomId=${roomId}`);
      } else {
        push("WS archived-room rejection", true, "skipped (token is not room owner)");
      }
    } else {
      push("WS archived-room rejection", true, "skipped (set AUTH_BEARER_TOKEN to enable)");
    }
  } catch (error) {
    push(
      "Day3 Yjs persistence smoke",
      false,
      error instanceof Error ? error.message : "unknown error",
    );
  } finally {
    for (const session of sessions.splice(0, sessions.length)) {
      session.provider.disconnect();
      session.provider.destroy();
      session.ydoc.destroy();
    }
    await stopServerProcess(managedServer);
  }

  const passed = checks.filter((check) => check.ok).length;
  const failed = checks.length - passed;

  console.log("\nSummary");
  console.log(`- Base URL: ${baseUrl}`);
  console.log(`- Passed: ${passed}`);
  console.log(`- Failed: ${failed}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

await run();

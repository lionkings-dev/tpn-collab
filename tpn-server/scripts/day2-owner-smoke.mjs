import { CLAIM_ROOM_STATUS } from "@tpn/contracts/room-contracts";
import { spawn } from "child_process";
import { config as loadDotenv } from "dotenv";
import { setTimeout as delay } from "timers/promises";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = dirname(scriptPath);
const backendRoot = resolve(scriptDir, "..");

loadDotenv({ path: resolve(backendRoot, ".env") });

const baseUrl = (process.env.ROOM_API_URL || "http://localhost:1234").replace(/\/$/, "");
const authToken = process.env.AUTH_BEARER_TOKEN || "";

function randomSuffix(length = 7) {
  return Math.random().toString(36).slice(2, 2 + length);
}

function buildRoomId(prefix) {
  return `${prefix}-${randomSuffix(8)}`;
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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
  for (let index = 0; index < maxRetries; index += 1) {
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

async function run() {
  const checks = [];
  let managedServer = null;
  const push = (name, ok, details = "") => {
    checks.push({ name, ok, details });
    console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${details ? ` - ${details}` : ""}`);
  };

  let failed = false;

  try {
    const healthyBeforeRun = await isServerHealthy();
    if (!healthyBeforeRun) {
      managedServer = startServerProcess();
      await waitForHealthy();
      push("Server bootstraps", true, "started by day2 smoke");
    } else {
      push("Server bootstraps", true, "using existing server");
    }

    const health = await request("/");
    assert(health.response.ok, "Health endpoint failed");
    push("Health endpoint", true, `status=${health.response.status}`);

    const roomId = buildRoomId("qa-day2-owner");
    const register = await request(`/api/rooms/${encodeURIComponent(roomId)}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "QA Day2 Owner Flow" }),
    });
    assert(register.response.status === 201, "Room register should return 201");
    assert(register.json?.ok === true, "Room register should return ok=true");
    assert(typeof register.json?.claimToken === "string", "Register should return claimToken");
    const claimToken = register.json.claimToken;
    push("Anonymous register returns claim token", true, `roomId=${roomId}`);

    const mineUnauth = await request("/api/rooms/mine");
    assert(mineUnauth.response.status === 401, "GET /mine without token should return 401");
    push("Owned rooms requires auth", true, "401 without bearer");

    const claimUnauth = await request(`/api/rooms/${encodeURIComponent(roomId)}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claimToken }),
    });
    assert(claimUnauth.response.status === 401, "Claim without token should return 401");
    push("Claim endpoint requires auth", true, "401 without bearer");

    if (!authToken) {
      push(
        "Authenticated owner branch",
        true,
        "skipped (set AUTH_BEARER_TOKEN to enable)",
      );
    } else {
      const authHeaders = {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      };

      const claim = await request(`/api/rooms/${encodeURIComponent(roomId)}/claim`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ claimToken }),
      });
      assert(claim.response.ok, "Claim with valid token should succeed");
      assert(claim.json?.ok === true, "Claim should return ok=true");
      assert(
        claim.json?.claimStatus === CLAIM_ROOM_STATUS.CLAIMED ||
          claim.json?.claimStatus === CLAIM_ROOM_STATUS.ALREADY_OWNED_BY_YOU,
        "Claim status should be claimed or already_owned_by_you",
      );
      push("Claim room ownership", true, `status=${claim.json.claimStatus}`);

      const mine = await request("/api/rooms/mine", { headers: authHeaders });
      assert(mine.response.ok, "GET /mine with token should succeed");
      const ownedRooms = Array.isArray(mine.json?.rooms) ? mine.json.rooms : [];
      assert(ownedRooms.some((room) => room.roomId === roomId), "Owned room list should include room");
      push("Owned rooms list includes claimed room", true, `roomId=${roomId}`);

      const privateRoom = await request(`/api/rooms/${encodeURIComponent(roomId)}/private`, {
        headers: authHeaders,
      });
      assert(privateRoom.response.ok, "Owner private room lookup should succeed");
      assert(privateRoom.json?.room?.ownerId, "Private room metadata should include ownerId");
      push("Owner can read private room metadata", true, `roomId=${roomId}`);

      const renamed = await request(`/api/rooms/${encodeURIComponent(roomId)}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ name: "QA Day2 Renamed" }),
      });
      assert(renamed.response.ok, "PATCH rename should succeed for owner");
      assert(renamed.json?.room?.name === "QA Day2 Renamed", "Rename response should return updated name");
      push("Owner can rename room", true, "PATCH /api/rooms/:roomId");

      const archived = await request(`/api/rooms/${encodeURIComponent(roomId)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      assert(archived.response.ok, "DELETE archive should succeed for owner");
      push("Owner can archive room", true, "DELETE /api/rooms/:roomId");

      const existsAfterArchive = await request(`/api/rooms/${encodeURIComponent(roomId)}/exists`);
      assert(existsAfterArchive.response.ok, "Exists check after archive should succeed");
      assert(
        existsAfterArchive.json?.exists === false,
        "Archived room should not appear as existing in strict guard",
      );
      push("Archived room hidden from exists", true, `roomId=${roomId}`);
    }
  } catch (error) {
    failed = true;
    push("Day2 owner smoke", false, error instanceof Error ? error.message : "unknown error");
  } finally {
    await stopServerProcess(managedServer);
  }

  const passedCount = checks.filter((check) => check.ok).length;
  const failedCount = checks.length - passedCount;

  console.log("\nSummary");
  console.log(`- Base URL: ${baseUrl}`);
  console.log(`- Passed: ${passedCount}`);
  console.log(`- Failed: ${failedCount}`);

  if (failed || failedCount > 0) {
    process.exitCode = 1;
  }
}

await run();

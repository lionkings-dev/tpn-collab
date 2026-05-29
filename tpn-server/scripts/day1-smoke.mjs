import { AUTH_ERROR_CODES, ROOM_ERROR_CODES } from "@tpn/contracts/error-codes";
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

function randomSuffix(length = 6) {
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

  const pushResult = (name, ok, details = "") => {
    checks.push({ name, ok, details });
    const marker = ok ? "PASS" : "FAIL";
    const suffix = details ? ` - ${details}` : "";
    console.log(`[${marker}] ${name}${suffix}`);
  };

  try {
    const healthyBeforeRun = await isServerHealthy();
    if (!healthyBeforeRun) {
      managedServer = startServerProcess();
      await waitForHealthy();
      pushResult("Server bootstraps", true, "started by day1 smoke");
    } else {
      pushResult("Server bootstraps", true, "using existing server");
    }

    const health = await request("/");
    assert(health.response.ok, "Server health endpoint failed");
    pushResult("Health endpoint", true, `status=${health.response.status}`);

    const unauthMe = await request("/api/me");
    assert(unauthMe.response.status === 401, "Expected /api/me to return 401 without token");
    assert(
      unauthMe.json?.error === AUTH_ERROR_CODES.MISSING_BEARER_TOKEN,
      `Expected ${AUTH_ERROR_CODES.MISSING_BEARER_TOKEN} error`,
    );
    pushResult("GET /api/me without token", true, `401 ${AUTH_ERROR_CODES.MISSING_BEARER_TOKEN}`);

    const invalidRoom = await request("/api/rooms/BAD/exists");
    assert(invalidRoom.response.status === 400, "Expected invalid room id check to return 400");
    assert(
      invalidRoom.json?.error === ROOM_ERROR_CODES.INVALID_ROOM_ID,
      `Expected ${ROOM_ERROR_CODES.INVALID_ROOM_ID} error`,
    );
    pushResult("Room ID validation", true, "invalid room rejected");

    const anonRoomId = buildRoomId("qa-day1-anon");
    const existsBefore = await request(`/api/rooms/${encodeURIComponent(anonRoomId)}/exists`);
    assert(existsBefore.response.ok, "Anonymous exists check before register failed");
    assert(existsBefore.json?.exists === false, "Expected room to not exist before register");
    pushResult("Anonymous exists before register", true, `roomId=${anonRoomId}`);

    const registerAnon = await request(`/api/rooms/${encodeURIComponent(anonRoomId)}/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "QA Day1 Anonymous" }),
    });
    assert(registerAnon.response.status === 201, "Expected anonymous register to return 201");
    assert(registerAnon.json?.ok === true, "Expected anonymous register ok=true");
    pushResult("Anonymous room register", true, `roomId=${anonRoomId}`);

    const existsAfter = await request(`/api/rooms/${encodeURIComponent(anonRoomId)}/exists`);
    assert(existsAfter.response.ok, "Anonymous exists check after register failed");
    assert(existsAfter.json?.exists === true, "Expected room to exist after register");
    pushResult("Anonymous exists after register", true, `roomId=${anonRoomId}`);

    const publicRoom = await request(`/api/rooms/${encodeURIComponent(anonRoomId)}`);
    assert(publicRoom.response.ok, "Expected public room summary lookup to succeed");
    assert(typeof publicRoom.json?.room?.name === "string", "Expected public room summary to include name");
    assert(!("ownerId" in (publicRoom.json?.room || {})), "Public room summary should not expose ownerId");
    assert(!("status" in (publicRoom.json?.room || {})), "Public room summary should not expose status");
    pushResult("Public room summary is name-only", true, `roomId=${anonRoomId}`);

    const privateRoomUnauth = await request(`/api/rooms/${encodeURIComponent(anonRoomId)}/private`);
    assert(privateRoomUnauth.response.status === 401, "Expected private room metadata to require auth");
    pushResult("Private room metadata requires auth", true, "401 without bearer");

    const registerAnonAgain = await request(`/api/rooms/${encodeURIComponent(anonRoomId)}/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "QA Day1 Anonymous" }),
    });
    assert(registerAnonAgain.response.status === 201, "Expected idempotent register to return 201");
    assert(registerAnonAgain.json?.ok === true, "Expected idempotent register ok=true");
    pushResult("Idempotent register", true, `roomId=${anonRoomId}`);

    if (!authToken) {
      pushResult(
        "Authenticated checks",
        true,
        "skipped (set AUTH_BEARER_TOKEN to enable)",
      );
    } else {
      const authHeaders = {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      };

      const authMe = await request("/api/me", { headers: authHeaders });
      assert(authMe.response.ok, "Expected authenticated /api/me to succeed");
      assert(authMe.json?.user?.id, "Expected /api/me to return user id");
      pushResult("GET /api/me with token", true, `user=${authMe.json.user.email || authMe.json.user.id}`);

      const authRoomId = buildRoomId("qa-day1-auth");
      const registerAuth = await request(`/api/rooms/${encodeURIComponent(authRoomId)}/register`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ name: "QA Day1 Authenticated" }),
      });
      assert(registerAuth.response.status === 201, "Expected authenticated register to return 201");
      assert(registerAuth.json?.ok === true, "Expected authenticated register ok=true");
      assert(registerAuth.json?.ownerId, "Expected authenticated register to return ownerId");
      pushResult("Authenticated room register", true, `roomId=${authRoomId}`);
    }
  } catch (error) {
    pushResult(
      "Smoke run",
      false,
      error instanceof Error ? error.message : "Unknown error",
    );
  } finally {
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

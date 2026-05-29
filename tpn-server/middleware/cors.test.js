import { describe, it, expect, beforeEach, vi } from "vitest";

function makeReqRes(method = "GET", origin = null) {
  const headers = {};
  const req = {
    method,
    headers: { origin },
  };
  const res = {
    _headers: {},
    _status: null,
    setHeader(name, value) {
      this._headers[name] = value;
    },
    sendStatus(code) {
      this._status = code;
    },
  };
  const next = vi.fn();
  return { req, res, next };
}

async function loadMiddleware(corsOriginEnv) {
  vi.resetModules();
  if (corsOriginEnv !== undefined) {
    process.env.CORS_ORIGIN = corsOriginEnv;
  } else {
    delete process.env.CORS_ORIGIN;
  }
  const { corsMiddleware } = await import("./cors.js");
  return corsMiddleware;
}

describe("corsMiddleware (default origins)", () => {
  let corsMiddleware;

  beforeEach(async () => {
    corsMiddleware = await loadMiddleware(undefined);
  });

  it("sets ACAO header for allowed localhost origin", () => {
    const { req, res, next } = makeReqRes("GET", "http://localhost:5173");
    corsMiddleware(req, res, next);
    expect(res._headers["Access-Control-Allow-Origin"]).toBe("http://localhost:5173");
    expect(next).toHaveBeenCalled();
  });

  it("does not set ACAO header for unrecognized origin", () => {
    const { req, res, next } = makeReqRes("GET", "https://attacker.com");
    corsMiddleware(req, res, next);
    expect(res._headers["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it("always sets Allow-Methods and Allow-Headers", () => {
    const { req, res, next } = makeReqRes("GET", null);
    corsMiddleware(req, res, next);
    expect(res._headers["Access-Control-Allow-Methods"]).toBeTruthy();
    expect(res._headers["Access-Control-Allow-Headers"]).toBeTruthy();
  });

  it("responds 204 and does not call next for OPTIONS preflight", () => {
    const { req, res, next } = makeReqRes("OPTIONS", "http://localhost:5173");
    corsMiddleware(req, res, next);
    expect(res._status).toBe(204);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("corsMiddleware (custom CORS_ORIGIN)", () => {
  it("allows custom origin from env", async () => {
    const corsMiddleware = await loadMiddleware("https://app.example.com");
    const { req, res, next } = makeReqRes("GET", "https://app.example.com");
    corsMiddleware(req, res, next);
    expect(res._headers["Access-Control-Allow-Origin"]).toBe("https://app.example.com");
  });

  it("allows multiple origins from comma-separated env", async () => {
    const corsMiddleware = await loadMiddleware("https://a.com,https://b.com");
    const { req, res, next } = makeReqRes("GET", "https://b.com");
    corsMiddleware(req, res, next);
    expect(res._headers["Access-Control-Allow-Origin"]).toBe("https://b.com");
  });

  it("rejects origin not in custom list", async () => {
    const corsMiddleware = await loadMiddleware("https://app.example.com");
    const { req, res, next } = makeReqRes("GET", "http://localhost:5173");
    corsMiddleware(req, res, next);
    expect(res._headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });
});

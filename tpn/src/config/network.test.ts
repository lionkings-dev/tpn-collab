import { describe, it, expect, vi, afterEach } from "vitest";

import { resolveApiBaseUrl, resolveWsUrl } from "./network";

function mockWindow(hostname: string, protocol: string) {
  vi.stubGlobal("window", { location: { hostname, protocol } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resolveApiBaseUrl", () => {
  it("removes trailing slash from envUrl", () => {
    mockWindow("app.example.com", "https:");
    expect(resolveApiBaseUrl("https://api.example.com/")).toBe("https://api.example.com");
  });

  it("substitutes localhost hostname when runtime is non-localhost", () => {
    mockWindow("app.example.com", "http:");
    expect(resolveApiBaseUrl("http://localhost:1234/")).toBe("http://app.example.com:1234");
  });

  it("does not substitute when both env and runtime are localhost", () => {
    mockWindow("localhost", "http:");
    expect(resolveApiBaseUrl("http://localhost:1234")).toBe("http://localhost:1234");
  });

  it("does not substitute non-localhost envUrl", () => {
    mockWindow("app.example.com", "https:");
    expect(resolveApiBaseUrl("https://api.example.com")).toBe("https://api.example.com");
  });

  it("returns default localhost URL when no envUrl", () => {
    mockWindow("localhost", "http:");
    expect(resolveApiBaseUrl()).toBe("http://localhost:1234");
  });

  it("returns window-hostname-based URL when no envUrl on non-localhost", () => {
    mockWindow("app.example.com", "https:");
    expect(resolveApiBaseUrl()).toBe("http://app.example.com:1234");
  });
});

describe("resolveWsUrl", () => {
  it("upgrades ws: to wss: when page is https:", () => {
    mockWindow("app.example.com", "https:");
    expect(resolveWsUrl("ws://app.example.com:1234")).toBe("wss://app.example.com:1234/");
  });

  it("keeps ws: when page is http:", () => {
    mockWindow("app.example.com", "http:");
    expect(resolveWsUrl("ws://app.example.com:1234")).toBe("ws://app.example.com:1234/");
  });

  it("substitutes localhost hostname in ws URL", () => {
    mockWindow("app.example.com", "http:");
    expect(resolveWsUrl("ws://localhost:1234")).toBe("ws://app.example.com:1234/");
  });

  it("returns default ws URL when no envUrl", () => {
    mockWindow("localhost", "http:");
    expect(resolveWsUrl()).toBe("ws://localhost:1234");
  });

  it("returns window-hostname ws URL when no envUrl on non-localhost", () => {
    mockWindow("app.example.com", "http:");
    expect(resolveWsUrl()).toBe("ws://app.example.com:1234");
  });
});

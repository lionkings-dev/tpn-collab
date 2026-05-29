import { describe, it, expect } from "vitest";

import {
  generateRoomId,
  extractRoomIdFromInvite,
  normalizeRoomInput,
} from "./roomId";

describe("generateRoomId", () => {
  it("returns exactly 6 characters", () => {
    expect(generateRoomId()).toHaveLength(6);
  });

  it("uses only uppercase alphanumeric characters", () => {
    for (let i = 0; i < 20; i++) {
      expect(generateRoomId()).toMatch(/^[A-Z0-9]{6}$/);
    }
  });

  it("produces different values across multiple calls", () => {
    const ids = new Set(Array.from({ length: 10 }, generateRoomId));
    expect(ids.size).toBeGreaterThan(1);
  });
});

describe("extractRoomIdFromInvite", () => {
  it("returns null for empty string", () => {
    expect(extractRoomIdFromInvite("")).toBeNull();
  });

  it("returns plain string as-is when no URL structure", () => {
    expect(extractRoomIdFromInvite("ABC123")).toBe("ABC123");
  });

  it("extracts roomId from full HTTPS URL", () => {
    expect(extractRoomIdFromInvite("https://example.com/room/ABC123")).toBe("ABC123");
  });

  it("extracts roomId from localhost URL", () => {
    expect(extractRoomIdFromInvite("http://localhost:5173/room/XYZ789")).toBe("XYZ789");
  });

  it("returns null when path has no /room/ segment", () => {
    expect(extractRoomIdFromInvite("https://example.com/other/ABC123")).toBeNull();
  });

  it("returns null when URL with dot lacks /room/ path", () => {
    expect(extractRoomIdFromInvite("https://example.com/other/path")).toBeNull();
  });

  it("returns null when input has a dot but is not a valid URL", () => {
    expect(extractRoomIdFromInvite("not.a.url/room")).toBeNull();
  });

  it("treats string with colons but no /room/ as malformed URL returning null", () => {
    expect(extractRoomIdFromInvite("http://example.com/noroom/ABC123")).toBeNull();
  });
});

describe("normalizeRoomInput", () => {
  it("normalizes lowercase 6-char ID to uppercase", () => {
    expect(normalizeRoomInput("abc123")).toBe("ABC123");
  });

  it("normalizes uppercase 6-char ID unchanged", () => {
    expect(normalizeRoomInput("ABC123")).toBe("ABC123");
  });

  it("extracts and normalizes roomId from full URL", () => {
    expect(normalizeRoomInput("https://example.com/room/abc123")).toBe("ABC123");
  });

  it("returns null for empty input", () => {
    expect(normalizeRoomInput("")).toBeNull();
  });

  it("returns null when URL has no /room/ path", () => {
    expect(normalizeRoomInput("https://example.com/other/abc123")).toBeNull();
  });

  it("normalizes legacy hyphenated roomId to lowercase", () => {
    expect(normalizeRoomInput("My-Room-Id")).toBe("my-room-id");
  });
});

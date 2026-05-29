import { describe, it, expect } from "vitest";

import { isValidRoomId, normalizeRoomId } from "./roomId.js";

describe("isValidRoomId", () => {
  it("accepts a valid 6-char uppercase ID", () => {
    expect(isValidRoomId("ABC123")).toBe(true);
  });

  it("accepts a valid legacy hyphenated ID", () => {
    expect(isValidRoomId("my-room-id")).toBe(true);
  });

  it("rejects null / undefined", () => {
    expect(isValidRoomId(null)).toBe(false);
    expect(isValidRoomId(undefined)).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidRoomId("")).toBe(false);
  });

  it("rejects IDs with spaces", () => {
    expect(isValidRoomId("ABC 12")).toBe(false);
  });

  it("rejects IDs with special chars", () => {
    expect(isValidRoomId("ABC!23")).toBe(false);
  });

  it("rejects a 5-char ID (too short)", () => {
    expect(isValidRoomId("ABCDE")).toBe(false);
  });

  it("accepts a 6-char ID at exact boundary", () => {
    expect(isValidRoomId("ABCDEF")).toBe(true);
  });
});

describe("normalizeRoomId", () => {
  it("uppercases a 6-char lowercase ID", () => {
    expect(normalizeRoomId("abc123")).toBe("ABC123");
  });

  it("leaves a 6-char uppercase ID unchanged", () => {
    expect(normalizeRoomId("ABC123")).toBe("ABC123");
  });

  it("lowercases a legacy hyphenated ID", () => {
    expect(normalizeRoomId("My-Room")).toBe("my-room");
  });

  it("trims whitespace before normalizing", () => {
    expect(normalizeRoomId("  abc123  ")).toBe("ABC123");
  });

  it("returns empty string for null/undefined", () => {
    expect(normalizeRoomId(null)).toBe("");
    expect(normalizeRoomId(undefined)).toBe("");
  });
});

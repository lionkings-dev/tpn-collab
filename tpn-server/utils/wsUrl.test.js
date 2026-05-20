import { describe, it, expect } from "vitest";

import { resolveRoomIdFromUpgradeUrl } from "./wsUrl.js";

describe("resolveRoomIdFromUpgradeUrl", () => {
  it("extracts and normalizes a 6-char room ID from path", () => {
    const { roomId } = resolveRoomIdFromUpgradeUrl("/abc123");
    expect(roomId).toBe("ABC123");
  });

  it("extracts room ID from nested path (last segment)", () => {
    const { roomId } = resolveRoomIdFromUpgradeUrl("/room/abc123");
    expect(roomId).toBe("ABC123");
  });

  it("preserves query string as search", () => {
    const { search } = resolveRoomIdFromUpgradeUrl("/room/ABC123?v=3");
    expect(search).toBe("?v=3");
  });

  it("returns empty string for search when no query", () => {
    const { search } = resolveRoomIdFromUpgradeUrl("/ABC123");
    expect(search).toBe("");
  });

  it("handles null rawUrl gracefully (defaults to root path)", () => {
    const { roomId } = resolveRoomIdFromUpgradeUrl(null);
    expect(roomId).toBe("");
  });

  it("normalizes lowercase 6-char ID to uppercase", () => {
    const { roomId } = resolveRoomIdFromUpgradeUrl("/xyzabc");
    expect(roomId).toBe("XYZABC");
  });
});

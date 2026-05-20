import { describe, it, expect, vi, beforeEach } from "vitest";

import { toInteger } from "./roomCleanup.js";

vi.mock("./roomsRepo.js", () => ({
  findIdleOwnerlessActiveRooms: vi.fn(),
  archiveOwnerlessRoomsByIds: vi.fn(),
}));

import { findIdleOwnerlessActiveRooms, archiveOwnerlessRoomsByIds } from "./roomsRepo.js";
import { runIdleOwnerlessRoomCleanup } from "./roomCleanup.js";

describe("toInteger", () => {
  it("returns the integer part of a positive float", () => {
    expect(toInteger(3.9, 10)).toBe(3);
  });

  it("returns fallback for NaN", () => {
    expect(toInteger(NaN, 10)).toBe(10);
  });

  it("returns fallback for 0 (not positive)", () => {
    expect(toInteger(0, 10)).toBe(10);
  });

  it("returns fallback for negative values", () => {
    expect(toInteger(-5, 10)).toBe(10);
  });

  it("returns the integer for a string numeric value", () => {
    expect(toInteger("7", 10)).toBe(7);
  });

  it("returns fallback for non-numeric string", () => {
    expect(toInteger("abc", 10)).toBe(10);
  });
});

describe("runIdleOwnerlessRoomCleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns dry-run result with candidates without archiving", async () => {
    const fakeRoom = { roomId: "ROOM01" };
    findIdleOwnerlessActiveRooms.mockResolvedValue([fakeRoom]);

    const result = await runIdleOwnerlessRoomCleanup({ idleDays: 30, dryRun: true, limit: 10 });

    expect(result.dryRun).toBe(true);
    expect(result.candidateCount).toBe(1);
    expect(result.archivedCount).toBe(0);
    expect(archiveOwnerlessRoomsByIds).not.toHaveBeenCalled();
  });

  it("archives rooms when dryRun is false", async () => {
    findIdleOwnerlessActiveRooms.mockResolvedValue([{ roomId: "ROOM01" }, { roomId: "ROOM02" }]);
    archiveOwnerlessRoomsByIds.mockResolvedValue({ matchedCount: 2, modifiedCount: 2 });

    const result = await runIdleOwnerlessRoomCleanup({ dryRun: false });

    expect(archiveOwnerlessRoomsByIds).toHaveBeenCalledWith(["ROOM01", "ROOM02"]);
    expect(result.archivedCount).toBe(2);
    expect(result.dryRun).toBe(false);
  });

  it("computes cutoff date from idleDays", async () => {
    findIdleOwnerlessActiveRooms.mockResolvedValue([]);
    const before = Date.now();
    const result = await runIdleOwnerlessRoomCleanup({ idleDays: 7, dryRun: true });
    const after = Date.now();

    const expectedMs = 7 * 24 * 60 * 60 * 1000;
    const cutoffMs = result.cutoff.getTime();
    expect(before - cutoffMs).toBeGreaterThanOrEqual(expectedMs - 100);
    expect(after - cutoffMs).toBeLessThanOrEqual(expectedMs + 100);
  });

  it("skips archive call when candidate list is empty", async () => {
    findIdleOwnerlessActiveRooms.mockResolvedValue([]);

    const result = await runIdleOwnerlessRoomCleanup({ dryRun: false });

    expect(archiveOwnerlessRoomsByIds).not.toHaveBeenCalled();
    expect(result.archivedCount).toBe(0);
  });
});

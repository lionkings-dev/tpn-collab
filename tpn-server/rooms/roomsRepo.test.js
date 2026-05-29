import { describe, it, expect } from "vitest";
import { ObjectId } from "mongodb";

import { normalizeRoomDoc, buildError, toOwnerObjectId, hashClaimToken } from "./roomsRepo.js";

describe("normalizeRoomDoc", () => {
  it("maps _id to roomId", () => {
    const doc = {
      _id: "ROOM01",
      name: "Test Room",
      ownerId: null,
      visibility: "private",
      status: "active",
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01"),
      lastAccessedAt: new Date("2025-01-01"),
    };
    const result = normalizeRoomDoc(doc);
    expect(result.roomId).toBe("ROOM01");
    expect(result.name).toBe("Test Room");
    expect(result.ownerId).toBeNull();
  });

  it("converts ObjectId ownerId to string", () => {
    const oid = new ObjectId();
    const doc = {
      _id: "ROOM01",
      name: "Room",
      ownerId: oid,
      visibility: "private",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastAccessedAt: new Date(),
    };
    const result = normalizeRoomDoc(doc);
    expect(typeof result.ownerId).toBe("string");
    expect(result.ownerId).toBe(oid.toString());
  });

  it("includes all expected fields", () => {
    const now = new Date();
    const doc = {
      _id: "ROOM01",
      name: "Room",
      ownerId: null,
      visibility: "private",
      status: "active",
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,
    };
    const result = normalizeRoomDoc(doc);
    expect(Object.keys(result)).toEqual(
      expect.arrayContaining(["roomId", "name", "ownerId", "visibility", "status", "createdAt", "updatedAt", "lastAccessedAt"]),
    );
  });
});

describe("buildError", () => {
  it("creates an Error with the given code as message", () => {
    const err = buildError("room_not_found");
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("room_not_found");
  });

  it("attaches the code property", () => {
    const err = buildError("room_not_found");
    expect(err.code).toBe("room_not_found");
  });
});

describe("toOwnerObjectId", () => {
  it("returns null for null input", () => {
    expect(toOwnerObjectId(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(toOwnerObjectId(undefined)).toBeNull();
  });

  it("returns null for an invalid ObjectId string", () => {
    expect(toOwnerObjectId("not-an-objectid")).toBeNull();
  });

  it("returns an ObjectId for a valid 24-char hex string", () => {
    const id = new ObjectId().toString();
    const result = toOwnerObjectId(id);
    expect(result).toBeInstanceOf(ObjectId);
  });
});

describe("hashClaimToken", () => {
  it("returns a 64-char hex string", () => {
    const hash = hashClaimToken("sometoken");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same input", () => {
    expect(hashClaimToken("token")).toBe(hashClaimToken("token"));
  });

  it("produces different hashes for different inputs", () => {
    expect(hashClaimToken("tokenA")).not.toBe(hashClaimToken("tokenB"));
  });
});

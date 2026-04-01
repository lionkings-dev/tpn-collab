import { createHash, randomBytes } from "crypto";
import { ObjectId } from "mongodb";

import { getCollection } from "../db/mongo.js";

let indexesReady = false;

const ROOMS_INDEXES = {
  ownerUpdatedAt: { ownerId: 1, updatedAt: -1 },
  lastAccessedAt: { lastAccessedAt: 1 },
};

function normalizeRoomDoc(roomDoc) {
  return {
    roomId: roomDoc._id,
    name: roomDoc.name,
    ownerId: roomDoc.ownerId ? String(roomDoc.ownerId) : null,
    visibility: roomDoc.visibility,
    status: roomDoc.status,
    createdAt: roomDoc.createdAt,
    updatedAt: roomDoc.updatedAt,
    lastAccessedAt: roomDoc.lastAccessedAt,
  };
}

function buildError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

async function getRoomsCollection() {
  const rooms = await getCollection("rooms");

  if (!indexesReady) {
    await ensureRoomsIndexes(rooms);
    indexesReady = true;
  }

  return rooms;
}

async function ensureRoomsIndexes(roomsCollection) {
  await roomsCollection.createIndex(ROOMS_INDEXES.ownerUpdatedAt);
  await roomsCollection.createIndex(ROOMS_INDEXES.lastAccessedAt);

  const indexes = await roomsCollection.listIndexes().toArray();
  const hasIndexKey = (keyShape) =>
    indexes.some((index) => JSON.stringify(index.key) === JSON.stringify(keyShape));

  const idIndex = indexes.find(
    (index) => index.name === "_id_" && JSON.stringify(index.key) === JSON.stringify({ _id: 1 }),
  );
  if (!idIndex) {
    throw new Error("rooms_index_validation_failed:_id_unique_missing");
  }

  if (!hasIndexKey(ROOMS_INDEXES.ownerUpdatedAt)) {
    throw new Error("rooms_index_validation_failed:owner_updatedAt_missing");
  }

  if (!hasIndexKey(ROOMS_INDEXES.lastAccessedAt)) {
    throw new Error("rooms_index_validation_failed:lastAccessedAt_missing");
  }

  console.log("Rooms indexes ready", {
    collection: "rooms",
    indexes: indexes.map((index) => index.name),
  });
}

function toOwnerObjectId(ownerId) {
  if (!ownerId) return null;
  if (!ObjectId.isValid(ownerId)) return null;
  return new ObjectId(ownerId);
}

function createClaimToken() {
  return randomBytes(24).toString("base64url");
}

function hashClaimToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export async function roomExists(roomId) {
  const rooms = await getRoomsCollection();
  const room = await rooms.findOne(
    { _id: roomId, status: { $ne: "archived" } },
    { projection: { _id: 1 } },
  );
  return Boolean(room);
}

export async function getRoomById(roomId) {
  const rooms = await getRoomsCollection();
  const room = await rooms.findOne({
    _id: roomId,
    status: { $ne: "archived" },
  });

  if (!room) {
    throw buildError("room_not_found");
  }

  return normalizeRoomDoc(room);
}

export async function getPublicRoomById(roomId) {
  const rooms = await getRoomsCollection();
  const room = await rooms.findOne(
    {
      _id: roomId,
      status: { $ne: "archived" },
    },
    {
      projection: { _id: 0, name: 1 },
    },
  );

  if (!room) {
    throw buildError("room_not_found");
  }

  return {
    name: room.name,
  };
}

export async function getOwnedRoomById({ roomId, ownerId }) {
  const rooms = await getRoomsCollection();
  const ownerObjectId = toOwnerObjectId(ownerId);

  if (!ownerObjectId) {
    throw buildError("invalid_owner_id");
  }

  const room = await rooms.findOne({
    _id: roomId,
    status: { $ne: "archived" },
  });

  if (!room) {
    throw buildError("room_not_found");
  }

  if (!room.ownerId || String(room.ownerId) !== String(ownerObjectId)) {
    throw buildError("forbidden_room_owner_only");
  }

  return normalizeRoomDoc(room);
}

export async function registerRoom({ roomId, roomName, ownerId }) {
  const rooms = await getRoomsCollection();
  const now = new Date();
  const ownerObjectId = toOwnerObjectId(ownerId);
  const claimToken = ownerObjectId ? null : createClaimToken();

  const setOnInsert = {
    _id: roomId,
    name: roomName || "Untitled Model",
    ownerId: ownerObjectId,
    visibility: "private",
    status: "active",
    createdAt: now,
  };

  if (claimToken) {
    setOnInsert.claimTokenHash = hashClaimToken(claimToken);
    setOnInsert.claimTokenIssuedAt = now;
  }

  const updateResult = await rooms.updateOne(
    { _id: roomId },
    {
      $setOnInsert: setOnInsert,
      $set: {
        updatedAt: now,
        lastAccessedAt: now,
      },
    },
    { upsert: true },
  );

  const savedRoom = await rooms.findOne({ _id: roomId });
  if (!savedRoom) {
    throw new Error("Failed to register room.");
  }

  return {
    ...normalizeRoomDoc(savedRoom),
    claimToken: updateResult.upsertedCount === 1 ? claimToken : null,
  };
}

export async function claimRoomOwnership({ roomId, ownerId, claimToken }) {
  const rooms = await getRoomsCollection();
  const now = new Date();
  const ownerObjectId = toOwnerObjectId(ownerId);

  if (!ownerObjectId) {
    throw buildError("invalid_owner_id");
  }

  if (!claimToken?.trim()) {
    throw buildError("claim_token_invalid_or_missing");
  }

  const claimTokenHash = hashClaimToken(claimToken.trim());

  const claimResult = await rooms.updateOne(
    {
      _id: roomId,
      ownerId: null,
      status: { $ne: "archived" },
      claimTokenHash,
    },
    {
      $set: {
        ownerId: ownerObjectId,
        updatedAt: now,
        claimedAt: now,
      },
      $unset: {
        claimTokenHash: "",
        claimTokenIssuedAt: "",
      },
    },
  );

  if (claimResult.modifiedCount === 1) {
    const claimedRoom = await rooms.findOne({ _id: roomId });
    if (!claimedRoom) {
      throw buildError("room_not_found");
    }
    return {
      room: normalizeRoomDoc(claimedRoom),
      claimStatus: "claimed",
    };
  }

  const existingRoom = await rooms.findOne({ _id: roomId });
  if (!existingRoom || existingRoom.status === "archived") {
    throw buildError("room_not_found");
  }

  if (existingRoom.ownerId) {
    if (String(existingRoom.ownerId) === String(ownerObjectId)) {
      return {
        room: normalizeRoomDoc(existingRoom),
        claimStatus: "already_owned_by_you",
      };
    }
    throw buildError("room_already_claimed");
  }

  throw buildError("claim_token_invalid_or_missing");
}

export async function getOwnedRooms(ownerId) {
  const rooms = await getRoomsCollection();
  const ownerObjectId = toOwnerObjectId(ownerId);

  if (!ownerObjectId) {
    throw buildError("invalid_owner_id");
  }

  const result = await rooms
    .find(
      {
        ownerId: ownerObjectId,
        status: { $ne: "archived" },
      },
      {
        sort: { updatedAt: -1 },
      },
    )
    .toArray();

  return result.map((roomDoc) => normalizeRoomDoc(roomDoc));
}

export async function renameOwnedRoom({ roomId, ownerId, name }) {
  const rooms = await getRoomsCollection();
  const ownerObjectId = toOwnerObjectId(ownerId);

  if (!ownerObjectId) {
    throw buildError("invalid_owner_id");
  }

  const now = new Date();
  const normalizedName = name.trim();

  const updateResult = await rooms.findOneAndUpdate(
    {
      _id: roomId,
      ownerId: ownerObjectId,
      status: { $ne: "archived" },
    },
    {
      $set: {
        name: normalizedName,
        updatedAt: now,
      },
    },
    {
      returnDocument: "after",
    },
  );

  if (updateResult) {
    return normalizeRoomDoc(updateResult);
  }

  const existingRoom = await rooms.findOne({ _id: roomId });
  if (!existingRoom || existingRoom.status === "archived") {
    throw buildError("room_not_found");
  }

  if (!existingRoom.ownerId || String(existingRoom.ownerId) !== String(ownerObjectId)) {
    throw buildError("forbidden_room_owner_only");
  }

  throw buildError("room_rename_failed");
}

export async function archiveOwnedRoom({ roomId, ownerId }) {
  const rooms = await getRoomsCollection();
  const ownerObjectId = toOwnerObjectId(ownerId);

  if (!ownerObjectId) {
    throw buildError("invalid_owner_id");
  }

  const now = new Date();

  const updateResult = await rooms.updateOne(
    {
      _id: roomId,
      ownerId: ownerObjectId,
      status: { $ne: "archived" },
    },
    {
      $set: {
        status: "archived",
        updatedAt: now,
      },
    },
  );

  if (updateResult.modifiedCount === 1) {
    return;
  }

  const existingRoom = await rooms.findOne({ _id: roomId });
  if (!existingRoom || existingRoom.status === "archived") {
    throw buildError("room_not_found");
  }

  if (!existingRoom.ownerId || String(existingRoom.ownerId) !== String(ownerObjectId)) {
    throw buildError("forbidden_room_owner_only");
  }

  throw buildError("room_archive_failed");
}

export async function findIdleOwnerlessActiveRooms({
  idleBefore,
  limit = 500,
} = {}) {
  if (!(idleBefore instanceof Date) || Number.isNaN(idleBefore.getTime())) {
    throw buildError("invalid_idle_before");
  }

  const rooms = await getRoomsCollection();
  const result = await rooms
    .find(
      {
        status: "active",
        ownerId: null,
        lastAccessedAt: { $lte: idleBefore },
      },
      {
        sort: { lastAccessedAt: 1 },
        limit,
      },
    )
    .toArray();

  return result.map((roomDoc) => normalizeRoomDoc(roomDoc));
}

export async function archiveOwnerlessRoomsByIds(roomIds) {
  if (!Array.isArray(roomIds) || roomIds.length === 0) {
    return {
      matchedCount: 0,
      modifiedCount: 0,
    };
  }

  const rooms = await getRoomsCollection();
  const now = new Date();

  const result = await rooms.updateMany(
    {
      _id: { $in: roomIds },
      status: "active",
      ownerId: null,
    },
    {
      $set: {
        status: "archived",
        updatedAt: now,
      },
    },
  );

  return {
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount,
  };
}

export async function initializeRoomsStorage() {
  const rooms = await getCollection("rooms");
  await ensureRoomsIndexes(rooms);
  indexesReady = true;
}

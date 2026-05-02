import { createHash, randomBytes } from "crypto";
import { ObjectId } from "mongodb";
import {
  CLAIM_ROOM_STATUS,
  ROOM_STATUS,
  ROOM_VISIBILITY,
} from "@tpn/contracts/room-contracts";
import { ROOM_ERROR_CODES } from "@tpn/contracts/error-codes";

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
    { _id: roomId, status: { $ne: ROOM_STATUS.ARCHIVED } },
    { projection: { _id: 1 } },
  );
  return Boolean(room);
}

export async function getRoomById(roomId) {
  const rooms = await getRoomsCollection();
  const room = await rooms.findOne({
    _id: roomId,
    status: { $ne: ROOM_STATUS.ARCHIVED },
  });

  if (!room) {
    throw buildError(ROOM_ERROR_CODES.ROOM_NOT_FOUND);
  }

  return normalizeRoomDoc(room);
}

export async function getPublicRoomById(roomId) {
  const rooms = await getRoomsCollection();
  const room = await rooms.findOne(
    {
      _id: roomId,
      status: { $ne: ROOM_STATUS.ARCHIVED },
    },
    {
      projection: { _id: 0, name: 1 },
    },
  );

  if (!room) {
    throw buildError(ROOM_ERROR_CODES.ROOM_NOT_FOUND);
  }

  return {
    name: room.name,
  };
}

export async function getOwnedRoomById({ roomId, ownerId }) {
  const rooms = await getRoomsCollection();
  const ownerObjectId = toOwnerObjectId(ownerId);

  if (!ownerObjectId) {
    throw buildError(ROOM_ERROR_CODES.INVALID_OWNER_ID);
  }

  const room = await rooms.findOne({
    _id: roomId,
    status: { $ne: ROOM_STATUS.ARCHIVED },
  });

  if (!room) {
    throw buildError(ROOM_ERROR_CODES.ROOM_NOT_FOUND);
  }

  if (!room.ownerId || String(room.ownerId) !== String(ownerObjectId)) {
    throw buildError(ROOM_ERROR_CODES.FORBIDDEN_ROOM_OWNER_ONLY);
  }

  return normalizeRoomDoc(room);
}

export async function registerRoom({ roomId, roomName, ownerId }) {
  const rooms = await getRoomsCollection();
  const now = new Date();
  const ownerObjectId = toOwnerObjectId(ownerId);
  const claimToken = ownerObjectId ? null : createClaimToken();

  const roomDocument = {
    _id: roomId,
    name: roomName || "Untitled Model",
    ownerId: ownerObjectId,
    visibility: ROOM_VISIBILITY.PRIVATE,
    status: ROOM_STATUS.ACTIVE,
    createdAt: now,
    updatedAt: now,
    lastAccessedAt: now,
  };

  if (claimToken) {
    roomDocument.claimTokenHash = hashClaimToken(claimToken);
    roomDocument.claimTokenIssuedAt = now;
  }

  try {
    await rooms.insertOne(roomDocument);
  } catch (error) {
    const duplicateKeyCode =
      typeof error === "object" && error !== null && "code" in error ? error.code : null;
    if (duplicateKeyCode === 11000) {
      throw buildError(ROOM_ERROR_CODES.ROOM_ID_COLLISION);
    }
    throw error;
  }

  return {
    ...normalizeRoomDoc(roomDocument),
    claimToken,
  };
}

export async function claimRoomOwnership({ roomId, ownerId, claimToken }) {
  const rooms = await getRoomsCollection();
  const now = new Date();
  const ownerObjectId = toOwnerObjectId(ownerId);

  if (!ownerObjectId) {
    throw buildError(ROOM_ERROR_CODES.INVALID_OWNER_ID);
  }

  if (!claimToken?.trim()) {
    throw buildError(ROOM_ERROR_CODES.CLAIM_TOKEN_INVALID_OR_MISSING);
  }

  const claimTokenHash = hashClaimToken(claimToken.trim());

  const claimResult = await rooms.updateOne(
    {
      _id: roomId,
      ownerId: null,
      status: { $ne: ROOM_STATUS.ARCHIVED },
      claimTokenHash,
    },
    {
      $set: {
        ownerId: ownerObjectId,
        updatedAt: now,
        lastAccessedAt: now,
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
      throw buildError(ROOM_ERROR_CODES.ROOM_NOT_FOUND);
    }
    return {
      room: normalizeRoomDoc(claimedRoom),
      claimStatus: CLAIM_ROOM_STATUS.CLAIMED,
    };
  }

  const existingRoom = await rooms.findOne({ _id: roomId });
  if (!existingRoom || existingRoom.status === ROOM_STATUS.ARCHIVED) {
    throw buildError(ROOM_ERROR_CODES.ROOM_NOT_FOUND);
  }

  if (existingRoom.ownerId) {
    if (String(existingRoom.ownerId) === String(ownerObjectId)) {
      return {
        room: normalizeRoomDoc(existingRoom),
        claimStatus: CLAIM_ROOM_STATUS.ALREADY_OWNED_BY_YOU,
      };
    }
    throw buildError(ROOM_ERROR_CODES.ROOM_ALREADY_CLAIMED);
  }

  throw buildError(ROOM_ERROR_CODES.CLAIM_TOKEN_INVALID_OR_MISSING);
}

export async function touchRoomLastAccessed(roomId) {
  const rooms = await getRoomsCollection();
  const result = await rooms.updateOne(
    {
      _id: roomId,
      status: { $ne: ROOM_STATUS.ARCHIVED },
    },
    {
      $set: {
        lastAccessedAt: new Date(),
      },
    },
  );

  return result.modifiedCount === 1;
}

export async function getOwnedRooms(ownerId) {
  const rooms = await getRoomsCollection();
  const ownerObjectId = toOwnerObjectId(ownerId);

  if (!ownerObjectId) {
    throw buildError(ROOM_ERROR_CODES.INVALID_OWNER_ID);
  }

  const result = await rooms
    .find(
      {
        ownerId: ownerObjectId,
        status: { $ne: ROOM_STATUS.ARCHIVED },
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
    throw buildError(ROOM_ERROR_CODES.INVALID_OWNER_ID);
  }

  const now = new Date();
  const normalizedName = name.trim();

  const updateResult = await rooms.findOneAndUpdate(
    {
      _id: roomId,
      ownerId: ownerObjectId,
      status: { $ne: ROOM_STATUS.ARCHIVED },
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
  if (!existingRoom || existingRoom.status === ROOM_STATUS.ARCHIVED) {
    throw buildError(ROOM_ERROR_CODES.ROOM_NOT_FOUND);
  }

  if (!existingRoom.ownerId || String(existingRoom.ownerId) !== String(ownerObjectId)) {
    throw buildError(ROOM_ERROR_CODES.FORBIDDEN_ROOM_OWNER_ONLY);
  }

  throw buildError(ROOM_ERROR_CODES.ROOM_RENAME_FAILED);
}

export async function archiveOwnedRoom({ roomId, ownerId }) {
  const rooms = await getRoomsCollection();
  const ownerObjectId = toOwnerObjectId(ownerId);

  if (!ownerObjectId) {
    throw buildError(ROOM_ERROR_CODES.INVALID_OWNER_ID);
  }

  const now = new Date();

  const updateResult = await rooms.updateOne(
    {
      _id: roomId,
      ownerId: ownerObjectId,
      status: { $ne: ROOM_STATUS.ARCHIVED },
    },
    {
      $set: {
        status: ROOM_STATUS.ARCHIVED,
        updatedAt: now,
      },
    },
  );

  if (updateResult.modifiedCount === 1) {
    return;
  }

  const existingRoom = await rooms.findOne({ _id: roomId });
  if (!existingRoom || existingRoom.status === ROOM_STATUS.ARCHIVED) {
    throw buildError(ROOM_ERROR_CODES.ROOM_NOT_FOUND);
  }

  if (!existingRoom.ownerId || String(existingRoom.ownerId) !== String(ownerObjectId)) {
    throw buildError(ROOM_ERROR_CODES.FORBIDDEN_ROOM_OWNER_ONLY);
  }

  throw buildError(ROOM_ERROR_CODES.ROOM_ARCHIVE_FAILED);
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
        status: ROOM_STATUS.ACTIVE,
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
      status: ROOM_STATUS.ACTIVE,
      ownerId: null,
    },
    {
      $set: {
        status: ROOM_STATUS.ARCHIVED,
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

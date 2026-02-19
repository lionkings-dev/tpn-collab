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

export async function roomExists(roomId) {
  const rooms = await getRoomsCollection();
  const room = await rooms.findOne(
    { _id: roomId, status: { $ne: "archived" } },
    { projection: { _id: 1 } },
  );
  return Boolean(room);
}

export async function registerRoom({ roomId, roomName, ownerId }) {
  const rooms = await getRoomsCollection();
  const now = new Date();
  const ownerObjectId = toOwnerObjectId(ownerId);

  await rooms.updateOne(
    { _id: roomId },
    {
      $setOnInsert: {
        _id: roomId,
        name: roomName || "Untitled Model",
        ownerId: ownerObjectId,
        visibility: "private",
        status: "active",
        createdAt: now,
      },
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

  return normalizeRoomDoc(savedRoom);
}

export async function initializeRoomsStorage() {
  const rooms = await getCollection("rooms");
  await ensureRoomsIndexes(rooms);
  indexesReady = true;
}

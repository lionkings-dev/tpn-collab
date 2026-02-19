import { ObjectId } from "mongodb";

import { getCollection } from "../db/mongo.js";

let indexesReady = false;

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
    await rooms.createIndex({ ownerId: 1, updatedAt: -1 });
    await rooms.createIndex({ lastAccessedAt: 1 });
    indexesReady = true;
  }

  return rooms;
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

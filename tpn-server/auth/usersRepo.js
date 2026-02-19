import { getCollection } from "../db/mongo.js";

let indexesReady = false;

async function getUsersCollection() {
  const users = await getCollection("users");

  if (!indexesReady) {
    await users.createIndex({ email: 1 }, { unique: true });
    await users.createIndex({ provider: 1, providerId: 1 }, { unique: true });
    indexesReady = true;
  }

  return users;
}

function normalizeUserDoc(doc) {
  return {
    id: String(doc._id),
    provider: doc.provider,
    providerId: doc.providerId,
    email: doc.email,
    displayName: doc.displayName,
    photoURL: doc.photoURL || null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    lastLoginAt: doc.lastLoginAt,
  };
}

export async function upsertUserFromDecodedToken(decodedToken) {
  const users = await getUsersCollection();
  const now = new Date();
  const providerId = decodedToken.uid;
  const email = decodedToken.email || "";

  if (!providerId || !email) {
    throw new Error("Firebase token must include uid and email.");
  }

  await users.updateOne(
    {
      provider: "google",
      providerId,
    },
    {
      $set: {
        provider: "google",
        providerId,
        email,
        displayName: decodedToken.name || email,
        photoURL: decodedToken.picture || null,
        updatedAt: now,
        lastLoginAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    {
      upsert: true,
    },
  );

  const savedUser = await users.findOne({
    provider: "google",
    providerId,
  });

  if (!savedUser) {
    throw new Error("Failed to upsert authenticated user.");
  }

  return normalizeUserDoc(savedUser);
}

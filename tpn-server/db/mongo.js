import { MongoClient } from "mongodb";

let mongoClient = null;
let mongoDb = null;

function getMongoUri() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error("MONGODB_URI is required.");
  }
  return uri;
}

function getMongoDbName() {
  return process.env.MONGODB_DB_NAME?.trim() || "tpn_collab";
}

export function isMongoConfigured() {
  return Boolean(process.env.MONGODB_URI?.trim());
}

export async function getMongoDb() {
  if (!mongoClient) {
    mongoClient = new MongoClient(getMongoUri());
    await mongoClient.connect();
  }

  if (!mongoDb) {
    mongoDb = mongoClient.db(getMongoDbName());
  }

  return mongoDb;
}

export async function getMongoClient() {
  if (!mongoClient) {
    mongoClient = new MongoClient(getMongoUri());
    await mongoClient.connect();
  }

  return mongoClient;
}

export function getMongoDatabaseName() {
  return getMongoDbName();
}

export async function getCollection(name) {
  const db = await getMongoDb();
  return db.collection(name);
}

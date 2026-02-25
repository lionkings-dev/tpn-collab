import { setPersistence } from "@y/websocket-server/utils";
import { MongodbPersistence } from "y-mongodb-provider";
import * as Y from "yjs";

import { getMongoClient, getMongoDatabaseName, getMongoDb } from "../db/mongo.js";

const DEFAULT_COLLECTION_NAME = "yjs_updates";

let mongoPersistence = null;

function getYjsCollectionName() {
  return process.env.YJS_UPDATES_COLLECTION?.trim() || DEFAULT_COLLECTION_NAME;
}

async function ensureYjsIndexes() {
  const db = await getMongoDb();
  const collectionName = getYjsCollectionName();
  const collection = db.collection(collectionName);

  await collection.createIndex(
    { version: 1, docName: 1, action: 1, clock: 1, part: 1 },
    { name: "idx_yjs_version_doc_action_clock_part" },
  );

  const indexes = await collection.listIndexes().toArray();
  console.log("Yjs update indexes ready", {
    collection: collectionName,
    indexes: indexes.map((index) => index.name),
  });
}

async function getMongoPersistence() {
  if (mongoPersistence) {
    return mongoPersistence;
  }

  const client = await getMongoClient();
  const db = await getMongoDb();

  mongoPersistence = new MongodbPersistence(
    {
      client,
      db,
    },
    {
      collectionName: getYjsCollectionName(),
      multipleCollections: false,
      flushSize: 200,
    },
  );

  return mongoPersistence;
}

export async function initializeYjsPersistence() {
  await ensureYjsIndexes();

  const mdb = await getMongoPersistence();

  setPersistence({
    bindState: async (docName, ydoc) => {
      const persistedYdoc = await mdb.getYDoc(docName);

      const newUpdates = Y.encodeStateAsUpdate(ydoc);
      await mdb.storeUpdate(docName, newUpdates);

      Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(persistedYdoc));

      ydoc.on("update", async (update) => {
        await mdb.storeUpdate(docName, update);
      });

      persistedYdoc.destroy();
    },

    writeState: async (docName, _ydoc) => {
      await mdb.flushDocument(docName);
    },
  });

  console.log("Yjs Mongo persistence enabled", {
    database: getMongoDatabaseName(),
    collection: getYjsCollectionName(),
  });
}

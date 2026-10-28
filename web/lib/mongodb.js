import { MongoClient } from "mongodb";

// Cache the connection promise so we don't open a new client on every request
export function getClient() {
  if (!globalThis.mongoClientPromise) {
    const client = new MongoClient(process.env.MONGODB_URI);
    globalThis.mongoClientPromise = client.connect();
  }
  return globalThis.mongoClientPromise;
}

export async function getDb() {
  const client = await getClient();
  return client.db(process.env.MONGODB_DB);
}
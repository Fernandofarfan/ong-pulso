import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

let clientPromise: Promise<MongoClient> | null = null;

export function hasMongoConfig() {
  return Boolean(uri);
}

export function getMongoClient() {
  if (!uri) throw new Error("Missing MONGODB_URI");

  if (!clientPromise) {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    clientPromise = client.connect().catch((error) => {
      clientPromise = null;
      throw error;
    });
  }

  return clientPromise;
}

export async function getDatabase() {
  const client = await getMongoClient();
  return client.db(process.env.MONGODB_DB ?? "impact_protocol");
}

import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { IndexedAgreement } from "@/types/agreement";
import { getDatabase, hasMongoConfig } from "./mongodb";

const collectionName = "agreements";
const dataDir = path.join(process.cwd(), ".data");
const localFile = path.join(dataDir, "agreements.json");

async function readLocal(): Promise<IndexedAgreement[]> {
  try {
    const raw = await readFile(localFile, "utf8");
    const parsed = JSON.parse(raw) as IndexedAgreement[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeLocal(items: IndexedAgreement[]) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(localFile, JSON.stringify(items, null, 2), "utf8");
}

export async function listAgreements(): Promise<IndexedAgreement[]> {
  if (hasMongoConfig()) {
    const db = await getDatabase();
    const agreements = await db
      .collection<IndexedAgreement>(collectionName)
      .find({}, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .toArray();
    return agreements as IndexedAgreement[];
  }

  const items = await readLocal();
  return items.sort(
    (a, b) =>
      new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
  );
}

export async function upsertAgreement(agreement: IndexedAgreement) {
  if (hasMongoConfig()) {
    const db = await getDatabase();
    const { createdAt, ...rest } = agreement;
    await db.collection<IndexedAgreement>(collectionName).updateOne(
      { contractId: agreement.contractId },
      { $set: rest, $setOnInsert: { createdAt } },
      { upsert: true },
    );
    return;
  }

  const items = await readLocal();
  const index = items.findIndex(
    (item) => item.contractId === agreement.contractId,
  );

  if (index >= 0) {
    items[index] = {
      ...agreement,
      createdAt: items[index].createdAt || agreement.createdAt,
    };
  } else {
    items.push(agreement);
  }

  await writeLocal(items);
}

import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { IndexedAgreement } from "@/types/agreement";
import { getDatabase, hasMongoConfig } from "./mongodb";

const collectionName = "agreements";
const dataDir = path.join(process.cwd(), ".data");
const localFile = path.join(dataDir, "agreements.json");

const demoSeed: IndexedAgreement[] = [
  {
    contractId: "CCZBRUVFYUBH7DMWCQFL7LYO2V5UNVPSI2HAK7HCJA3IWCEE2QGFO5ZA",
    title: "Water Access Cohort",
    organization: "Pulso Foundation",
    metadataUri: "ipfs://agreement-water-access",
    funder: "",
    grantee: "",
    arbiter: "",
    network: "testnet",
    milestones: [
      { id: 0, amount: "250", metadataUri: "ipfs://ms-water-0" },
      { id: 1, amount: "400", metadataUri: "ipfs://ms-water-1" },
      { id: 2, amount: "150", metadataUri: "ipfs://ms-water-2" },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    contractId: "CDEMO1111111111111111111111111111111111111111111111111111",
    title: "School Meals Expansion",
    organization: "Aestrial NGO",
    metadataUri: "ipfs://agreement-meals",
    funder: "",
    grantee: "",
    arbiter: "",
    network: "testnet",
    milestones: [
      { id: 0, amount: "120", metadataUri: "ipfs://ms-meals-0" },
      { id: 1, amount: "300", metadataUri: "ipfs://ms-meals-1" },
    ],
    createdAt: new Date(Date.now() - 86_400_000 * 4).toISOString(),
  },
  {
    contractId: "CDEMO2222222222222222222222222222222222222222222222222222",
    title: "Solar Clinic Kits",
    organization: "Impact Lab",
    metadataUri: "ipfs://agreement-solar",
    funder: "",
    grantee: "",
    arbiter: "",
    network: "testnet",
    milestones: [
      { id: 0, amount: "500", metadataUri: "ipfs://ms-solar-0" },
      { id: 1, amount: "200", metadataUri: "ipfs://ms-solar-1" },
      { id: 2, amount: "100", metadataUri: "ipfs://ms-solar-2" },
    ],
    createdAt: new Date(Date.now() - 86_400_000 * 12).toISOString(),
  },
  {
    contractId: "CDEMO3333333333333333333333333333333333333333333333333333",
    title: "Emergency Shelter Fund",
    organization: "Pulso Foundation",
    metadataUri: "ipfs://agreement-shelter",
    funder: "",
    grantee: "",
    arbiter: "",
    network: "testnet",
    milestones: [
      { id: 0, amount: "800", metadataUri: "ipfs://ms-shelter-0" },
      { id: 1, amount: "350", metadataUri: "ipfs://ms-shelter-1" },
    ],
    createdAt: new Date(Date.now() - 86_400_000 * 25).toISOString(),
  },
];

function sortAgreements(items: IndexedAgreement[]) {
  return [...items].sort(
    (a, b) =>
      new Date(b.createdAt ?? 0).getTime() -
      new Date(a.createdAt ?? 0).getTime(),
  );
}

function upsertInMemory(
  items: IndexedAgreement[],
  agreement: IndexedAgreement,
) {
  const index = items.findIndex(
    (item) => item.contractId === agreement.contractId,
  );
  if (index >= 0) {
    items[index] = {
      ...agreement,
      createdAt: items[index].createdAt || agreement.createdAt,
    };
    return items;
  }
  return [...items, agreement];
}

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
  try {
    await mkdir(dataDir, { recursive: true });
    await writeFile(localFile, JSON.stringify(items, null, 2), "utf8");
  } catch {
    // Vercel/serverless FS is read-only; in-memory still works per instance.
  }
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
  if (items.length === 0) return sortAgreements(demoSeed);
  return sortAgreements(items);
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
  const next = upsertInMemory(items.length > 0 ? items : demoSeed, agreement);
  await writeLocal(next);
}

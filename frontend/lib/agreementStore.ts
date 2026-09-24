import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { IndexedAgreement } from "@/types/agreement";
import { getDatabase, hasMongoConfig } from "./mongodb";

const collectionName = "agreements";
const dataDir = path.join(process.cwd(), ".data");
const localFile = path.join(dataDir, "agreements.json");

const iso = (epochSeconds: number) =>
  new Date(epochSeconds * 1000).toISOString();

// Seed mirrors contracts that really exist on testnet (verified via get_agreement /
// get_milestones). Never invent contract ids: clicking an entry loads it on-chain.
const demoSeed: IndexedAgreement[] = [
  {
    contractId: "CCZBRUVFYUBH7DMWCQFL7LYO2V5UNVPSI2HAK7HCJA3IWCEE2QGFO5ZA",
    title: "Water Access Cohort",
    organization: "Pulso Foundation",
    metadataUri: "ipfs://agreement",
    funder: "GBT7NTJIOY6UCYDTNBW4K57EF5KYRS3QGHGDTWQB4LJJV367DVIOJVY7",
    grantee: "GBT7NTJIOY6UCYDTNBW4K57EF5KYRS3QGHGDTWQB4LJJV367DVIOJVY7",
    arbiter: "GBT7NTJIOY6UCYDTNBW4K57EF5KYRS3QGHGDTWQB4LJJV367DVIOJVY7",
    network: "testnet",
    status: "Active",
    milestones: [
      {
        id: 0,
        amount: "100",
        metadataUri: "ipfs://milestone-0",
        status: "Completed",
        completedAt: iso(1782844643),
      },
      { id: 1, amount: "250", metadataUri: "ipfs://milestone-1", status: "Submitted" },
    ],
    createdAt: iso(1782840422),
  },
  {
    contractId: "CDMNZ2N4SOTF2W7JSRKIBUVR3726BA7YQQU2TKWPD7VEBLMS2WPYYKWI",
    title: "Solar Clinic Kits",
    organization: "Aestrial NGO",
    metadataUri: "ipfs://sdk-deploy-test",
    funder: "GB5Z7JSILTNODJS444RVDIGMRBMFR4VDQP4HBDF4OL2IHQ725S2QEZRO",
    grantee: "GB5Z7JSILTNODJS444RVDIGMRBMFR4VDQP4HBDF4OL2IHQ725S2QEZRO",
    arbiter: "GB5Z7JSILTNODJS444RVDIGMRBMFR4VDQP4HBDF4OL2IHQ725S2QEZRO",
    network: "testnet",
    status: "Draft",
    milestones: [
      { id: 0, amount: "50000000", metadataUri: "ipfs://sdk-ms-0", status: "Pending" },
    ],
    createdAt: iso(1790264797),
  },
  {
    contractId: "CAVSYUGO3XOTUKMK2ZTV3CE2OPW55N24EDJX4XXZ5EBJUCGGGGN644SK",
    title: "School Meals Expansion",
    organization: "Aestrial NGO",
    metadataUri: "ipfs://sdk-deploy-test",
    funder: "GB5Z7JSILTNODJS444RVDIGMRBMFR4VDQP4HBDF4OL2IHQ725S2QEZRO",
    grantee: "GB5Z7JSILTNODJS444RVDIGMRBMFR4VDQP4HBDF4OL2IHQ725S2QEZRO",
    arbiter: "GB5Z7JSILTNODJS444RVDIGMRBMFR4VDQP4HBDF4OL2IHQ725S2QEZRO",
    network: "testnet",
    status: "Draft",
    milestones: [
      { id: 0, amount: "50000000", metadataUri: "ipfs://sdk-ms-0", status: "Pending" },
    ],
    createdAt: iso(1790264847),
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
    const collection = db.collection<IndexedAgreement>(collectionName);
    const agreements = await collection
      .find({}, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .toArray();
    if (agreements.length > 0) return agreements as IndexedAgreement[];

    // First boot against an empty database: publish the verified testnet seed
    // so the dashboard is never blank. Upserts keep this idempotent.
    await Promise.all(
      demoSeed.map(({ createdAt, ...rest }) =>
        collection.updateOne(
          { contractId: rest.contractId },
          { $set: rest, $setOnInsert: { createdAt } },
          { upsert: true },
        ),
      ),
    );
    return sortAgreements(demoSeed);
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

import type { CreateAgreementInput, IndexedAgreement } from "@/types/agreement";

const DEPLOY_TOKEN_KEY = "aestrial-deploy-token";
const LOCAL_INDEX_KEY = "aestrial-local-agreements";

export function getDeployToken(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(DEPLOY_TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setDeployToken(token: string) {
  if (typeof window === "undefined") return;
  try {
    if (token) {
      window.localStorage.setItem(DEPLOY_TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(DEPLOY_TOKEN_KEY);
    }
  } catch {
    // ignore
  }
}

function readLocalIndex(): IndexedAgreement[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_INDEX_KEY);
    const parsed = raw ? (JSON.parse(raw) as IndexedAgreement[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalIndex(items: IndexedAgreement[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_INDEX_KEY, JSON.stringify(items));
  } catch {
    // storage full/unavailable: server index still works
  }
}

function rememberLocal(agreement: IndexedAgreement) {
  const items = readLocalIndex();
  const index = items.findIndex(
    (item) => item.contractId === agreement.contractId,
  );
  if (index >= 0) {
    items[index] = { ...items[index], ...agreement };
  } else {
    items.push(agreement);
  }
  writeLocalIndex(items);
}

/**
 * Records the freshest on-chain facts for an agreement in the browser index.
 * Used to enrich the server list (status, milestone states) when the server
 * has no database configured.
 */
export function rememberOnChainState(
  contractId: string,
  patch: Partial<IndexedAgreement>,
) {
  if (!contractId) return;
  const items = readLocalIndex();
  const existing = items.find((item) => item.contractId === contractId);
  rememberLocal({ ...existing, ...patch, contractId } as IndexedAgreement);
}

/**
 * Server list + agreements deployed from this browser that the server lost
 * (Vercel FS is read-only without MongoDB). Local status/milestone states
 * enrich the matching server entries.
 */
function mergeWithLocal(server: IndexedAgreement[]): IndexedAgreement[] {
  const local = readLocalIndex();
  if (local.length === 0) return server;

  const localById = new Map(local.map((item) => [item.contractId, item]));
  const merged = server.map((item) => {
    const extra = localById.get(item.contractId);
    if (!extra) return item;
    localById.delete(item.contractId);
    return {
      ...item,
      status: extra.status ?? item.status,
      milestones: item.milestones.map((milestone) => {
        const localMs = extra.milestones.find((m) => m.id === milestone.id);
        return localMs?.status
          ? { ...milestone, status: localMs.status, completedAt: localMs.completedAt ?? milestone.completedAt }
          : milestone;
      }),
    };
  });
  // Local-only entries (deployed here, lost by the server) come last.
  return [...merged, ...localById.values()];
}

export class AgreementIndexService {
  async list(): Promise<IndexedAgreement[]> {
    const response = await fetch("/api/agreements", { cache: "no-store" });
    const data = (await response.json().catch(() => ({}))) as {
      agreements?: IndexedAgreement[];
      error?: string;
    };
    if (!response.ok) {
      throw new Error(data.error ?? "Unable to load indexed agreements");
    }
    return mergeWithLocal(data.agreements ?? []);
  }

  async save(input: CreateAgreementInput): Promise<IndexedAgreement> {
    const response = await fetch("/api/agreements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const data = await readError(response);
      throw new Error(data.error ?? "Unable to save agreement");
    }

    const data = (await response.json()) as { agreement: IndexedAgreement };
    return data.agreement;
  }

  async deploy(input: CreateAgreementInput): Promise<IndexedAgreement> {
    const response = await fetch("/api/agreements/deploy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-deploy-token": getDeployToken(),
      },
      body: JSON.stringify(input),
      cache: "no-store",
    });

    if (!response.ok) {
      const data = await readError(response);
      throw new Error(data.error ?? "Unable to deploy agreement");
    }

    const data = (await response.json()) as { agreement: IndexedAgreement };
    // Keep a browser-side copy: serverless FS may silently drop the write
    // when no MongoDB is configured.
    rememberLocal(data.agreement);
    return data.agreement;
  }

  async status(): Promise<AppStatus> {
    const response = await fetch("/api/status", { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to load status");
    return response.json();
  }
}

async function readError(response: Response) {
  try {
    return (await response.clone().json()) as { error?: string };
  } catch {
    return { error: "Unexpected server response" };
  }
}

export type AppStatus = {
  storage: string;
  network: string;
  rpcUrl: string;
  contractId: string;
  deployEnabled: boolean;
  deployConfigured: {
    secretKey?: boolean;
    ownerAddress?: boolean;
    deployToken?: boolean;
    mongodb?: boolean;
    rootEnvError?: string | null;
  } & Record<string, boolean | string | null | undefined>;
};

import type { CreateAgreementInput, IndexedAgreement } from "@/types/agreement";

const DEPLOY_TOKEN_KEY = "aestrial-deploy-token";

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
    return data.agreements ?? [];
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

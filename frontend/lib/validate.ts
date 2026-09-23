import type { CreateAgreementInput, IndexedMilestone } from "@/types/agreement";

const CONTRACT_ID_PATTERN = /^C[A-Z0-9]{55}$/;
const ADDRESS_PATTERN = /^G[A-Z2-7]{55}$/;

function isShortString(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

function isOptionalAddress(value: unknown): value is string | undefined {
  return (
    value === undefined ||
    value === "" ||
    (typeof value === "string" && ADDRESS_PATTERN.test(value))
  );
}

function validateMilestones(milestones: unknown): {
  ok: boolean;
  error?: string;
  value?: IndexedMilestone[];
} {
  if (!Array.isArray(milestones) || milestones.length === 0 || milestones.length > 50) {
    return { ok: false, error: "milestones must be an array with 1 to 50 items" };
  }

  const parsed: IndexedMilestone[] = [];
  for (const [index, item] of milestones.entries()) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: `milestone #${index} must be an object` };
    }

    const candidate = item as Record<string, unknown>;
    const id = candidate.id;
    const amount = candidate.amount;
    const metadataUri = candidate.metadataUri;

    if (!Number.isInteger(id) || (id as number) < 0) {
      return { ok: false, error: `milestone #${index} id must be a non-negative integer` };
    }
    if (!isShortString(amount, 40) || !/^\d+$/.test(amount)) {
      return { ok: false, error: `milestone #${index} amount must be a positive integer string` };
    }
    if (!isShortString(metadataUri, 512)) {
      return { ok: false, error: `milestone #${index} metadataUri is required (max 512 chars)` };
    }

    parsed.push({ id: id as number, amount, metadataUri });
  }

  return { ok: true, value: parsed };
}

export function validateCreateAgreement(
  input: unknown,
): { ok: true; value: CreateAgreementInput } | { ok: false; error: string } {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "Body must be a JSON object" };
  }

  const body = input as Record<string, unknown>;

  if (!isShortString(body.title, 200)) {
    return { ok: false, error: "title is required (max 200 chars)" };
  }
  if (!isShortString(body.organization, 200)) {
    return { ok: false, error: "organization is required (max 200 chars)" };
  }
  if (!isShortString(body.metadataUri, 512)) {
    return { ok: false, error: "metadataUri is required (max 512 chars)" };
  }
  if (!isOptionalAddress(body.funder)) {
    return { ok: false, error: "funder must be a valid Stellar G... address" };
  }
  if (!isOptionalAddress(body.grantee)) {
    return { ok: false, error: "grantee must be a valid Stellar G... address" };
  }
  if (!isOptionalAddress(body.arbiter)) {
    return { ok: false, error: "arbiter must be a valid Stellar G... address" };
  }
  if (body.network !== undefined && body.network !== "testnet" && body.network !== "mainnet") {
    return { ok: false, error: "network must be testnet or mainnet" };
  }

  const milestones = validateMilestones(body.milestones);
  if (!milestones.ok || !milestones.value) {
    return { ok: false, error: milestones.error ?? "invalid milestones" };
  }

  return {
    ok: true,
    value: {
      contractId: "",
      title: body.title,
      organization: body.organization,
      metadataUri: body.metadataUri,
      funder: (body.funder as string | undefined) ?? "",
      grantee: (body.grantee as string | undefined) ?? "",
      arbiter: (body.arbiter as string | undefined) ?? "",
      network: (body.network as string | undefined) ?? "testnet",
      milestones: milestones.value,
    },
  };
}

export function validateIndexedUpsert(
  input: unknown,
): { ok: true; value: CreateAgreementInput } | { ok: false; error: string } {
  const base = validateCreateAgreement(input);
  if (!base.ok) return base;

  const body = input as Record<string, unknown>;
  if (!isShortString(body.contractId, 100) || !CONTRACT_ID_PATTERN.test(body.contractId)) {
    return { ok: false, error: "contractId must be a valid Stellar contract id (C...)" };
  }

  return {
    ok: true,
    value: { ...base.value, contractId: body.contractId },
  };
}

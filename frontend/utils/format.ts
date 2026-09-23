export function shortAddress(address?: string | null) {
  if (!address) return "Not connected";
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

export function formatUnixTime(timestamp?: bigint | number | null) {
  if (timestamp === null || timestamp === undefined) return "Not set";

  const value = typeof timestamp === "bigint" ? Number(timestamp) : timestamp;
  if (!Number.isFinite(value) || value <= 0) return "Not set";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value * 1000));
}

export function formatAmount(amount: bigint | number | string) {
  const numeric = typeof amount === "bigint" ? Number(amount) : Number(amount);
  if (!Number.isFinite(numeric)) return String(amount);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    numeric,
  );
}

export function formatIsoDate(iso?: string) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function relativeTime(iso?: string) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatIsoDate(iso);
}

export function enumTag(value: { tag: string } | string) {
  return typeof value === "string" ? value : value.tag;
}

export function parseContractErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");

  if (/#3\b|Unauthorized/i.test(raw)) {
    return "Unauthorized: your wallet does not hold the required role for this action.";
  }
  if (/#4\b|InvalidState/i.test(raw)) {
    return "This action is not allowed in the current agreement state.";
  }
  if (/#5\b|MilestoneNotFound/i.test(raw)) {
    return "Milestone not found on this contract.";
  }
  if (/#6\b|InvalidMilestoneState/i.test(raw)) {
    return "This milestone is not in the required state for that action.";
  }
  if (/#7\b|InvalidRole/i.test(raw)) {
    return "Invalid role for this operation.";
  }
  if (/#8\b|InvalidAmount/i.test(raw)) {
    return "Amount must be greater than zero.";
  }
  if (/#9\b|InvalidMetadataUri/i.test(raw)) {
    return "Metadata URI is missing or invalid.";
  }
  if (/#2\b|NotInitialized/i.test(raw)) {
    return "This contract is not initialized.";
  }
  if (/simulate|simulation/i.test(raw)) {
    return "Transaction simulation failed. Check the agreement state and your wallet role.";
  }

  return raw.length > 220 ? `${raw.slice(0, 220)}…` : raw;
}

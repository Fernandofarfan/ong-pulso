export type ActivityEntry = {
  id: string;
  type:
    | "agreement"
    | "lifecycle"
    | "milestone"
    | "donation"
    | "deploy"
    | "session";
  title: string;
  detail?: string;
  at: string;
};

const STORAGE_KEY = "aestrial-activity-v1";
const MAX_ENTRIES = 100;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getActivity(): ActivityEntry[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as ActivityEntry[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function logActivity(entry: {
  type: ActivityEntry["type"];
  title: string;
  detail?: string;
}): ActivityEntry {
  const full: ActivityEntry = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: entry.type,
    title: entry.title,
    detail: entry.detail,
    at: new Date().toISOString(),
  };

  if (canUseStorage()) {
    try {
      const next = [full, ...getActivity()].slice(0, MAX_ENTRIES);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // localStorage may be unavailable; entry is still returned.
    }
  }

  return full;
}

export function clearActivity() {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

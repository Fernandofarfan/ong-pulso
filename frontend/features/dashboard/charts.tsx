"use client";

import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "./parts";
import { enumTag, formatAmount } from "@/utils/format";
import type { Milestone } from "@/contracts/funding-agreement/src";
import type { IndexedAgreement } from "@/types/agreement";
import { useMemo, useState } from "react";

type FundingBucket = { key: string; label: string; value: number };
type Range = "6m" | "ytd" | "1y" | "all";

function buildFundingBuckets(agreements: IndexedAgreement[]): FundingBucket[] {
  const byMonth = new Map<string, number>();

  for (const agreement of agreements) {
    const date = new Date(agreement.createdAt);
    if (Number.isNaN(date.getTime())) continue;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const total = agreement.milestones.reduce(
      (sum, milestone) => sum + (Number(milestone.amount) || 0),
      0,
    );
    byMonth.set(key, (byMonth.get(key) ?? 0) + total);
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => {
      const [year, month] = key.split("-");
      const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(
        "en",
        { month: "short" },
      );
      return { key, label, value };
    });
}

function filterRange(buckets: FundingBucket[], range: Range): FundingBucket[] {
  if (range === "all") return buckets;
  if (range === "ytd") {
    const year = String(new Date().getFullYear());
    return buckets.filter((bucket) => bucket.key.startsWith(year));
  }
  const now = new Date();
  const monthsBack = range === "1y" ? 12 : 6;
  const cutoff = new Date(
    now.getFullYear(),
    now.getMonth() - (monthsBack - 1),
    1,
  );
  return buckets.filter((bucket) => {
    const [year, month] = bucket.key.split("-").map(Number);
    return new Date(year, month - 1, 1) >= cutoff;
  });
}

export function FundingVolumeChart({
  agreements,
}: {
  agreements: IndexedAgreement[];
}) {
  const [range, setRange] = useState<Range>("6m");
  const buckets = useMemo(
    () => filterRange(buildFundingBuckets(agreements), range),
    [agreements, range],
  );

  const max = Math.max(1, ...buckets.map((bucket) => bucket.value));

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <CardHeader
          title="Funding Volume"
          description="Total milestone amount by creation month (indexed agreements)."
        />
        <select
          className="mb-5 rounded-lg border border-outline bg-background px-2 py-1 font-mono text-xs text-foreground outline-none focus:border-primary"
          onChange={(event) => setRange(event.target.value as Range)}
          value={range}
        >
          <option value="6m">6M</option>
          <option value="ytd">YTD</option>
          <option value="1y">1Y</option>
          <option value="all">All</option>
        </select>
      </div>

      {buckets.length === 0 ? (
        <EmptyState
          title="No funding data yet"
          description="Deploy or index an agreement to populate this chart."
        />
      ) : (
        <div className="relative">
          <div className="flex h-48 items-end gap-3">
            {buckets.map((bucket, index) => {
              const height = Math.max(6, Math.round((bucket.value / max) * 100));
              return (
                <div
                  className="group relative flex-1"
                  key={`${bucket.label}-${index}`}
                >
                  <div
                    className="w-full rounded-t-sm bg-primary/30 transition-all hover:bg-primary/60"
                    style={{
                      height: `${height}%`,
                      animation: `fillUp 0.7s ease-out ${index * 0.08}s both`,
                    }}
                  />
                  <div className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-surface-high px-2 py-1 text-xs text-foreground shadow-lg group-hover:block">
                    {formatAmount(bucket.value)} XLM
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex gap-3 border-t border-outline/40 pt-2">
            {buckets.map((bucket, index) => (
              <span
                className="flex-1 text-center font-mono text-[10px] text-muted"
                key={`label-${bucket.label}-${index}`}
              >
                {bucket.label}
              </span>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fillUp {
          from { transform: scaleY(0); }
          to { transform: scaleY(1); }
        }
      `}</style>
    </Card>
  );
}

const milestoneColors: Record<string, string> = {
  Pending: "#64748b",
  Submitted: "#a78bfa",
  Approved: "#34d399",
  Rejected: "#f87171",
  Completed: "#38bdf8",
};

export function MilestoneStatusChart({ milestones }: { milestones: Milestone[] }) {
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const milestone of milestones) {
      const tag = enumTag(milestone.status);
      map.set(tag, (map.get(tag) ?? 0) + 1);
    }
    return map;
  }, [milestones]);

  const total = milestones.length;
  const entries = [...counts.entries()].filter(([, count]) => count > 0);

  let cursor = 0;
  const segments = entries.map(([status, count]) => {
    const start = cursor;
    const end = cursor + (count / Math.max(1, total)) * 100;
    cursor = end;
    return `${milestoneColors[status] ?? "#64748b"} ${start}% ${end}%`;
  });
  const gradient =
    segments.length > 0
      ? `conic-gradient(${segments.join(", ")})`
      : "conic-gradient(#3e4850 0% 100%)";

  return (
    <Card>
      <CardHeader
        title="Milestone Status"
        description="Distribution of milestones for the active agreement."
      />

      {total === 0 ? (
        <EmptyState
          title="No milestones loaded"
          description="Select a valid contract to inspect milestone status."
        />
      ) : (
        <div className="flex flex-1 flex-wrap items-center justify-center gap-8">
          <div
            className="relative flex h-40 w-40 shrink-0 items-center justify-center rounded-full"
            style={{ background: gradient }}
          >
            <div className="relative z-10 flex h-28 w-28 flex-col items-center justify-center rounded-full bg-background">
              <span className="text-2xl font-bold text-foreground">{total}</span>
              <span className="font-mono text-xs text-muted">Total</span>
            </div>
          </div>

          <div className="flex min-w-40 flex-col gap-3">
            {(["Pending", "Submitted", "Approved", "Rejected", "Completed"] as const).map(
              (status) => (
                <div
                  className="flex w-36 items-center justify-between gap-4 text-sm"
                  key={status}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded"
                      style={{
                        background: milestoneColors[status],
                      }}
                    />
                    <span className="text-foreground">{status}</span>
                  </div>
                  <span className="font-medium text-foreground">
                    {counts.get(status) ?? 0}
                  </span>
                </div>
              ),
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

const agreementStatusColors: Record<string, string> = {
  Active: "#89ceff",
  Completed: "#34d399",
  Paused: "#ffb86e",
  Draft: "#d2bbff",
  Cancelled: "#f87171",
  Archived: "#94a3b8",
};

const agreementStatusOrder = [
  "Active",
  "Completed",
  "Paused",
  "Draft",
  "Cancelled",
  "Archived",
] as const;

export function AgreementStatusChart({
  agreements,
}: {
  agreements: IndexedAgreement[];
}) {
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const agreement of agreements) {
      const status = agreement.status ?? "Draft";
      map.set(status, (map.get(status) ?? 0) + 1);
    }
    return map;
  }, [agreements]);

  const total = agreements.length;
  const entries = agreementStatusOrder
    .map((status) => [status, counts.get(status) ?? 0] as const)
    .filter(([, count]) => count > 0);

  // Prefix sums → conic-gradient stops without mutating render locals.
  const cumulative = entries.reduce<number[]>(
    (acc, [, count]) => [...acc, (acc[acc.length - 1] ?? 0) + count],
    [],
  );
  const scale = 100 / Math.max(1, total);
  const segments = entries.map(([status], index) => {
    const start = (cumulative[index - 1] ?? 0) * scale;
    const end = cumulative[index] * scale;
    return `${agreementStatusColors[status]} ${start}% ${end}%`;
  });
  const gradient =
    segments.length > 0
      ? `conic-gradient(${segments.join(", ")})`
      : "conic-gradient(#3e4850 0% 100%)";

  return (
    <Card>
      <CardHeader
        title="Status Distribution"
        description="Indexed agreements by last known on-chain status."
      />

      {total === 0 ? (
        <EmptyState
          title="No agreements indexed"
          description="Deploy an agreement to populate this chart."
        />
      ) : (
        <div className="flex flex-1 flex-wrap items-center justify-center gap-8">
          <div
            className="relative flex h-40 w-40 shrink-0 items-center justify-center rounded-full"
            style={{ background: gradient }}
          >
            <div className="relative z-10 flex h-28 w-28 flex-col items-center justify-center rounded-full bg-background">
              <span className="text-2xl font-bold text-foreground">{total}</span>
              <span className="font-mono text-xs text-muted">Total</span>
            </div>
          </div>

          <div className="flex min-w-40 flex-col gap-3">
            {entries.map(([status, count]) => (
              <div
                className="flex w-36 items-center justify-between gap-4 text-sm"
                key={status}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded"
                    style={{ background: agreementStatusColors[status] }}
                  />
                  <span className="text-foreground">{status}</span>
                </div>
                <span className="font-medium text-foreground">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

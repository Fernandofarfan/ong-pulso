"use client";

import { clearActivity, getActivity, type ActivityEntry } from "@/lib/activity";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { setDeployToken, getDeployToken } from "@/services/AgreementIndexService";
import type { AppStatus } from "@/services/AgreementIndexService";
import { EmptyState, Field, RowCard, StatCard } from "./parts";
import { totalAgreementAmount } from "./AgreementIndexPanel";
import type { IndexedAgreement, IndexedMilestone } from "@/types/agreement";
import { formatAmount, formatIsoDate, relativeTime, shortAddress } from "@/utils/format";
import { useMemo, useState } from "react";

export function OrganizationsPanel({
  agreements,
  search,
  onSelectAgreement,
}: {
  agreements: IndexedAgreement[];
  search: string;
  onSelectAgreement: (contractId: string) => void;
}) {
  const organizations = useMemo(() => {
    const query = search.trim().toLowerCase();
    const map = new Map<
      string,
      { name: string; agreements: number; funds: number; contracts: string[] }
    >();

    for (const agreement of agreements) {
      const existing = map.get(agreement.organization) ?? {
        name: agreement.organization,
        agreements: 0,
        funds: 0,
        contracts: [],
      };
      existing.agreements += 1;
      existing.funds += totalAgreementAmount(agreement);
      existing.contracts.push(agreement.contractId);
      map.set(agreement.organization, existing);
    }

    return [...map.values()]
      .filter((org) => !query || org.name.toLowerCase().includes(query))
      .sort((a, b) => b.funds - a.funds || a.name.localeCompare(b.name));
  }, [agreements, search]);

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Organizations" value={String(organizations.length)} />
        <StatCard
          label="Total Funding"
          value={`${formatAmount(
            organizations.reduce((sum, org) => sum + org.funds, 0),
          )} XLM`}
        />
        <StatCard
          label="Agreements Covered"
          value={String(organizations.reduce((sum, org) => sum + org.agreements, 0))}
        />
      </section>

      <Card>
        <CardHeader
          title="Organizations"
          description="Derived from the agreement index. Click a row to open its latest agreement."
        />
        {organizations.length === 0 ? (
          <EmptyState
            title="No organizations yet"
            description="Organizations appear once you index funding agreements."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {organizations.map((org) => (
              <RowCard
                key={org.name}
                meta={`${formatAmount(org.funds)} XLM across ${org.agreements} agreement${org.agreements === 1 ? "" : "s"}`}
                onSelect={
                  org.contracts[0]
                    ? () => onSelectAgreement(org.contracts[0])
                    : undefined
                }
                status={org.agreements > 0 ? "Active" : "Draft"}
                subtitle={`Contracts: ${org.contracts
                  .slice(0, 2)
                  .map(shortAddress)
                  .join(", ")}${org.contracts.length > 2 ? "…" : ""}`}
                title={org.name}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export function DisbursementsPanel({
  contractId,
  milestones,
  isLoading,
  error,
}: {
  contractId: string;
  milestones: IndexedMilestone[] | undefined;
  isLoading: boolean;
  error: unknown;
}) {
  const rows = (milestones ?? []).map((milestone) => ({
    id: `MS-${String(milestone.id).padStart(3, "0")}`,
    milestone: `Milestone #${milestone.id}`,
    amount: `${formatAmount(milestone.amount)} XLM`,
    state: milestone.status ?? "Pending",
    completedAt: milestone.completedAt ?? null,
    metadataUri: milestone.metadataUri,
  }));

  const total = (milestones ?? []).reduce(
    (sum, milestone) => sum + (Number(milestone.amount) || 0),
    0,
  );
  const settled = (milestones ?? [])
    .filter((milestone) => milestone.status === "Completed")
    .reduce((sum, milestone) => sum + (Number(milestone.amount) || 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Disbursement Queue" value={String(rows.length)} />
        <StatCard label="Total Queued" value={`${formatAmount(total)} XLM`} />
        <StatCard label="Settled" value={`${formatAmount(settled)} XLM`} />
      </section>

      <Card>
        <CardHeader
          title="Disbursements"
          description={`Milestone settlement queue for ${shortAddress(contractId)}. Sourced from the indexed milestones of the selected agreement.`}
        />
        {isLoading ? (
          <p className="text-sm text-muted">Loading milestones...</p>
        ) : error ? (
          <EmptyState
            title="Milestones unavailable"
            description={
              error instanceof Error ? error.message : "Unable to load milestones."
            }
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Queue is empty"
            description="Select an agreement with milestones to see settlement rows."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-outline/70 font-mono text-xs uppercase tracking-wider text-muted">
                  <th className="p-3 font-medium">ID</th>
                  <th className="p-3 font-medium">Milestone</th>
                  <th className="p-3 font-medium">Amount</th>
                  <th className="p-3 font-medium">State</th>
                  <th className="p-3 font-medium">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline/40 text-sm">
                {rows.map((row) => (
                  <tr className="transition hover:bg-surface-low/60" key={row.id}>
                    <td className="p-3 font-mono text-primary">{row.id}</td>
                    <td className="p-3 text-foreground">{row.milestone}</td>
                    <td className="p-3 font-mono text-foreground">{row.amount}</td>
                    <td className="p-3">
                      <span className="rounded-full border border-outline bg-surface-high px-2 py-1 font-mono text-xs text-muted">
                        {row.state}
                      </span>
                    </td>
                    <td className="p-3 text-muted">
                      {row.completedAt ? formatIsoDate(row.completedAt) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export function ActivityPanel({
  agreements,
  storageVersion,
  onCleared,
  search,
}: {
  agreements: IndexedAgreement[];
  storageVersion: number;
  onCleared: () => void;
  search: string;
}) {
  const local = getActivity();
  const derived: ActivityEntry[] = agreements.map((agreement) => ({
    id: `idx-${agreement.contractId}`,
    type: "agreement",
    title: `Agreement indexed: ${agreement.title}`,
    detail: `${agreement.organization} · ${shortAddress(agreement.contractId)}`,
    at: agreement.createdAt,
  }));

  const query = search.trim().toLowerCase();
  const merged = [...local, ...derived]
    .filter(
      (entry) =>
        !query ||
        entry.title.toLowerCase().includes(query) ||
        (entry.detail ?? "").toLowerCase().includes(query),
    )
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <CardHeader
          title="Activity"
          description="Session actions from localStorage merged with indexed agreement events."
        />
        <Button
          className="mb-5"
          variant="secondary"
          onClick={() => {
            clearActivity();
            onCleared();
          }}
        >
          Clear session log
        </Button>
      </div>

      {merged.length === 0 ? (
        <EmptyState
          title="No activity yet"
          description="Deploy, lifecycle actions and donations will show up here."
        />
      ) : (
        <div className="relative ml-3 space-y-6 border-l border-outline/70 pb-4">
          {merged.map((entry) => (
            <div className="relative pl-6" key={entry.id}>
              <span className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
              <div className="flex flex-col gap-1">
                <p className="text-sm text-foreground">
                  <span className="font-medium">{entry.title}</span>
                </p>
                {entry.detail ? (
                  <p className="text-xs text-muted">{entry.detail}</p>
                ) : null}
                <span className="font-mono text-xs text-muted">
                  {relativeTime(entry.at)} · {formatIsoDate(entry.at)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 font-mono text-xs text-muted">
        storage version: {storageVersion} · entries: {merged.length}
      </p>
    </Card>
  );
}

export function SettingsPanel({
  status,
  statusLoading,
  statusError,
}: {
  status?: AppStatus;
  statusLoading: boolean;
  statusError: unknown;
}) {
  const savedToken = useMemo(() => getDeployToken(), []);
  const [token, setToken] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [activityVersion, setActivityVersion] = useState(0);

  const tokenValue = token ?? savedToken;
  const config = status?.deployConfigured;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader
          title="Settings"
          description="Runtime configuration for this dashboard."
        />
        {statusLoading ? (
          <p className="text-sm text-muted">Loading status...</p>
        ) : statusError ? (
          <EmptyState
            title="Status unavailable"
            description="Unable to reach /api/status."
          />
        ) : status ? (
          <div className="space-y-3 text-sm">
            <SettingRow label="Network" value={status.network} />
            <SettingRow label="RPC URL" value={status.rpcUrl} />
            <SettingRow
              label="Active contract"
              value={shortAddress(status.contractId) || status.contractId}
            />
            <SettingRow
              label="Index storage"
              value={status.storage === "mongodb" ? "MongoDB" : "Local file"}
            />
            <SettingRow
              label="Deploy enabled"
              value={status.deployEnabled ? "Yes" : "No"}
            />
          </div>
        ) : null}

        {config ? (
          <div className="mt-5 rounded-xl border border-outline/60 bg-surface-low p-4">
            <p className="mb-2 font-mono text-xs uppercase tracking-[0.08em] text-muted">
              Root .env checklist
            </p>
            <ul className="space-y-1 text-sm">
              <Check ok={Boolean(config.secretKey)} label="SECRET_KEY" />
              <Check ok={Boolean(config.ownerAddress)} label="OWNER_ADDRESS" />
              <Check ok={Boolean(config.deployToken)} label="DEPLOY_API_TOKEN" />
              <Check ok={Boolean(config.mongodb)} label="MONGODB_URI" />
            </ul>
            {typeof config.rootEnvError === "string" && config.rootEnvError ? (
              <p className="mt-2 text-xs text-amber-300">{config.rootEnvError}</p>
            ) : null}
          </div>
        ) : null}
      </Card>

      <Card>
        <CardHeader
          title="Deploy token"
          description="Sent as x-deploy-token when creating agreements. Must match DEPLOY_API_TOKEN in the root .env."
        />
        <div className="space-y-4">
          <Field
            label="Token"
            onChange={(value) => {
              setToken(value);
              setSaved(false);
            }}
            placeholder="paste your deploy token"
            suppressHydrationWarning
            type="password"
            value={tokenValue}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => {
                setDeployToken(tokenValue.trim());
                setToken(tokenValue.trim());
                setSaved(true);
              }}
            >
              Save token
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setDeployToken("");
                setToken("");
                setSaved(true);
              }}
            >
              Clear
            </Button>
            {saved ? (
              <span className="font-mono text-sm text-primary">
                Saved to localStorage.
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted">
            The token never leaves your browser except on deploy requests to this
            app&apos;s API.
          </p>
        </div>

        <div className="mt-6 rounded-xl border border-outline/60 bg-surface-low p-4 text-sm text-muted">
          <p className="mb-1 font-mono text-xs uppercase tracking-[0.08em]">
            Local activity log
          </p>
          <p>
            Entries stored in your browser for the Activity feed. Version{" "}
            <span className="font-mono text-foreground">{activityVersion}</span>.
          </p>
          <Button
            className="mt-3"
            variant="ghost"
            onClick={() => {
              clearActivity();
              setActivityVersion((value) => value + 1);
            }}
          >
            Reset local log
          </Button>
        </div>
      </Card>
    </div>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-outline/60 bg-surface-low px-3 py-2">
      <span className="text-muted">{label}</span>
      <span className="truncate font-mono text-sm text-foreground">{value}</span>
    </div>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className={ok ? "text-emerald-300" : "text-amber-300"}>
        {ok ? "✓" : "○"}
      </span>
      <span className={ok ? "text-foreground" : "text-muted"}>{label}</span>
    </li>
  );
}

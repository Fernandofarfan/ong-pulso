"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  type AgreementRoles,
} from "@/hooks/useAgreement";
import type { IndexedAgreement } from "@/types/agreement";
import {
  enumTag,
  formatAmount,
  formatUnixTime,
  parseContractErrorMessage,
  relativeTime,
  shortAddress,
} from "@/utils/format";
import type { UseMutationResult } from "@tanstack/react-query";
import type {
  Agreement,
  Milestone,
} from "@/contracts/funding-agreement/src";
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  EmptyState,
  Info,
  NetworkBadge,
  StatCard,
} from "./parts";
import { FundingVolumeChart, MilestoneStatusChart } from "./charts";
import { totalAgreementAmount } from "./AgreementIndexPanel";
import type { ActivityEntry } from "@/lib/activity";

type LifecycleMutations = {
  activate: UseMutationResult<unknown, unknown, void>;
  pause: UseMutationResult<unknown, unknown, void>;
  resume: UseMutationResult<unknown, unknown, void>;
  cancel: UseMutationResult<unknown, unknown, void>;
  complete: UseMutationResult<unknown, unknown, void>;
  archive: UseMutationResult<unknown, unknown, void>;
  submitMilestone: UseMutationResult<unknown, unknown, number>;
  approveMilestone: UseMutationResult<unknown, unknown, number>;
  rejectMilestone: UseMutationResult<unknown, unknown, number>;
  completeMilestone: UseMutationResult<unknown, unknown, number>;
};

export function OverviewPanel({
  contractId,
  agreement,
  milestones,
  roles,
  isConnected,
  indexedAgreements,
  activity,
  mutations,
  donate,
  donationNotice,
  setDonationNotice,
  onSelectAgreement,
  onGoToAgreements,
  search,
}: {
  contractId: string;
  agreement: {
    data?: Agreement;
    isLoading: boolean;
    error: unknown;
  };
  milestones: {
    data?: Milestone[];
    isLoading: boolean;
    error: unknown;
  };
  roles: {
    data?: AgreementRoles;
    isLoading: boolean;
  };
  isConnected: boolean;
  indexedAgreements: IndexedAgreement[];
  activity: ActivityEntry[];
  mutations: LifecycleMutations;
  donate: UseMutationResult<
    { hash: string },
    unknown,
    { to: string; amount: string; milestoneId: number }
  >;
  donationNotice: string | null;
  setDonationNotice: Dispatch<SetStateAction<string | null>>;
  onSelectAgreement: (contractId: string) => void;
  onGoToAgreements: () => void;
  search: string;
}) {
  const [donationAmountByMilestone, setDonationAmountByMilestone] = useState<
    Record<number, string>
  >({});

  const milestoneList = milestones.data ?? [];
  const completedMilestones = milestoneList.filter(
    (milestone) => enumTag(milestone.status) === "Completed",
  ).length;
  const milestoneCount = milestoneList.length;
  const progress =
    milestoneCount === 0 ? 0 : (completedMilestones / milestoneCount) * 100;
  const currentStatus = agreement.data ? enumTag(agreement.data.status) : null;

  const roleData = roles.data;
  const roleReady = isConnected && Boolean(roleData);

  const anyMutating = Object.values(mutations).some(
    (mutation) => mutation.isPending,
  );
  const actionError =
    mutations.activate.error ??
    mutations.pause.error ??
    mutations.resume.error ??
    mutations.cancel.error ??
    mutations.complete.error ??
    mutations.archive.error ??
    mutations.submitMilestone.error ??
    mutations.approveMilestone.error ??
    mutations.rejectMilestone.error ??
    mutations.completeMilestone.error;

  const canLifecycle = (role: keyof AgreementRoles, status: string | null) => {
    if (!isConnected) return { disabled: true, hint: "Connect Freighter first" };
    if (!roleData) return { disabled: true, hint: "Checking wallet roles..." };
    if (!roleData[role]) {
      return { disabled: true, hint: `Requires ${role} role on this agreement` };
    }
    if (!status) return { disabled: true, hint: "Agreement not loaded" };
    return { disabled: false, hint: undefined };
  };

  const activateAllowed = canLifecycle("funder", currentStatus);
  const pauseAllowed = canLifecycle("funder", currentStatus);
  const resumeAllowed = canLifecycle("funder", currentStatus);
  const cancelAllowed = canLifecycle("funder", currentStatus);
  const completeAllowed = canLifecycle("arbiter", currentStatus);
  const archiveAllowed = canLifecycle("funder", currentStatus);

  const stats = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = query
      ? indexedAgreements.filter(
          (item) =>
            item.title.toLowerCase().includes(query) ||
            item.organization.toLowerCase().includes(query),
        )
      : indexedAgreements;

    const orgs = new Set(filtered.map((item) => item.organization));
    const totalMilestones = filtered.reduce(
      (sum, item) => sum + item.milestones.length,
      0,
    );
    const funds = filtered.reduce((sum, item) => sum + totalAgreementAmount(item), 0);

    return {
      total: filtered.length,
      orgs: orgs.size,
      totalMilestones,
      funds,
    };
  }, [indexedAgreements, search]);

  const tableRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = query
      ? indexedAgreements.filter(
          (item) =>
            item.title.toLowerCase().includes(query) ||
            item.organization.toLowerCase().includes(query),
        )
      : indexedAgreements;

    return [...filtered].sort(
      (a, b) =>
        new Date(b.createdAt ?? 0).getTime() -
        new Date(a.createdAt ?? 0).getTime(),
    );
  }, [indexedAgreements, search]);

  const donateToMilestone = (milestoneId: number, amount: string) => {
    if (!isConnected) {
      setDonationNotice("Connect Freighter before donating.");
      return;
    }
    if (!agreement.data?.grantee) {
      setDonationNotice("Agreement grantee not loaded yet.");
      return;
    }
    const numeric = Number(amount);
    if (!amount || !Number.isFinite(numeric) || numeric <= 0) {
      setDonationNotice("Enter a donation amount greater than 0 XLM.");
      return;
    }
    if (!/^\d+(\.\d{1,7})?$/.test(amount)) {
      setDonationNotice("Use a valid XLM amount (max 7 decimals).");
      return;
    }

    donate.mutate(
      { to: agreement.data.grantee, amount, milestoneId },
      {
        onError: (error) =>
          setDonationNotice(
            error instanceof Error ? error.message : "Donation failed.",
          ),
        onSuccess: (result) =>
          setDonationNotice(
            `Donated ${amount} XLM to Milestone #${milestoneId}. Tx: ${result.hash}`,
          ),
      },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Agreements" value={String(stats.total)} hint="indexed" />
        <StatCard label="Organizations" value={String(stats.orgs)} hint="unique" />
        <StatCard label="Total Milestones" value={String(stats.totalMilestones)} />
        <StatCard
          label="Funds Managed"
          value={`${formatAmount(stats.funds)} XLM`}
          hint="sum of milestone amounts"
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-outline/70 pb-4">
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.01em]">
                Active Agreements
              </h2>
              <p className="mt-1 text-sm text-muted">
                Click a row to load it on-chain into the dashboard.
              </p>
            </div>
            <Button variant="ghost" onClick={onGoToAgreements}>
              View All
            </Button>
          </div>

          {tableRows.length === 0 ? (
            <EmptyState
              title="No agreements yet"
              description="Deploy your first funding agreement to see it here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-outline/70 font-mono text-xs uppercase tracking-wider text-muted">
                    <th className="p-3 font-medium">Agreement</th>
                    <th className="p-3 font-medium">Organization</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium">Milestones</th>
                    <th className="p-3 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline/40 text-sm">
                  {tableRows.map((item) => {
                    const isActive = item.contractId === contractId;
                    return (
                      <tr
                        className="cursor-pointer transition hover:bg-surface-low/60"
                        key={item.contractId}
                        onClick={() => onSelectAgreement(item.contractId)}
                      >
                        <td className="p-3">
                          <div
                            className={`font-medium ${isActive ? "text-primary" : "text-foreground"}`}
                          >
                            {item.title}
                          </div>
                          <div className="font-mono text-xs text-muted">
                            {isActive
                              ? "Loaded"
                              : `Updated ${relativeTime(item.createdAt)}`}
                          </div>
                        </td>
                        <td className="p-3 text-muted">{item.organization}</td>
                        <td className="p-3">
                          {isActive && currentStatus ? (
                            <StatusBadge status={currentStatus} />
                          ) : (
                            <NetworkBadge network={item.network} />
                          )}
                        </td>
                        <td className="p-3 text-muted">
                          {item.milestones.length}
                          {isActive && milestoneCount > 0
                            ? ` · ${completedMilestones} done`
                            : ""}
                        </td>
                        <td className="p-3 text-right font-mono text-primary">
                          {formatAmount(totalAgreementAmount(item))} XLM
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Recent Activity" />
          <div className="relative max-h-[360px] overflow-y-auto pr-1">
            {activity.length === 0 ? (
              <EmptyState
                title="No activity yet"
                description="Actions you take in this session will appear here."
              />
            ) : (
              <div className="relative ml-3 space-y-5 border-l border-outline/70 pb-4">
                {activity.slice(0, 12).map((entry) => (
                  <div className="relative pl-5" key={entry.id}>
                    <span className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
                    <p className="text-sm text-foreground">
                      <span className="font-medium">{entry.title}</span>
                      {entry.detail ? (
                        <span className="block text-xs text-muted">
                          {entry.detail}
                        </span>
                      ) : null}
                    </p>
                    <span className="font-mono text-xs text-muted">
                      {relativeTime(entry.at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <FundingVolumeChart agreements={indexedAgreements} />
        <MilestoneStatusChart milestones={milestoneList} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader
            title="Agreement"
            description={`Contract ${shortAddress(contractId)}`}
          />

          {agreement.isLoading ? (
            <p className="text-sm text-muted">Loading agreement...</p>
          ) : agreement.error ? (
            <div>
              <p className="text-sm text-red-300">
                Could not load agreement. Check contract id and network.
              </p>
              <p className="mt-2 text-xs text-muted">
                {parseContractErrorMessage(agreement.error)}
              </p>
            </div>
          ) : agreement.data ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={agreement.data.status} />
                <span className="font-mono text-sm text-muted">
                  Metadata: {agreement.data.metadata_uri}
                </span>
              </div>

              <div className="grid gap-3 text-sm md:grid-cols-2">
                <Info label="Funder" value={shortAddress(agreement.data.funder)} />
                <Info label="Grantee" value={shortAddress(agreement.data.grantee)} />
                <Info label="Arbiter" value={shortAddress(agreement.data.arbiter)} />
                <Info
                  label="Updated"
                  value={formatUnixTime(agreement.data.updated_at)}
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={
                    activateAllowed.disabled || currentStatus !== "Draft"
                  }
                  title={activateAllowed.hint}
                  onClick={() => mutations.activate.mutate()}
                >
                  Activate
                </Button>
                <Button
                  disabled={pauseAllowed.disabled || currentStatus !== "Active"}
                  title={pauseAllowed.hint}
                  variant="secondary"
                  onClick={() => mutations.pause.mutate()}
                >
                  Pause
                </Button>
                <Button
                  disabled={resumeAllowed.disabled || currentStatus !== "Paused"}
                  title={resumeAllowed.hint}
                  variant="secondary"
                  onClick={() => mutations.resume.mutate()}
                >
                  Resume
                </Button>
                <Button
                  disabled={
                    completeAllowed.disabled || currentStatus !== "Active"
                  }
                  title={completeAllowed.hint}
                  onClick={() => mutations.complete.mutate()}
                >
                  Complete
                </Button>
                <Button
                  disabled={
                    cancelAllowed.disabled ||
                    currentStatus === null ||
                    ["Cancelled", "Completed", "Archived"].includes(currentStatus)
                  }
                  title={cancelAllowed.hint}
                  variant="secondary"
                  onClick={() => mutations.cancel.mutate()}
                >
                  Cancel
                </Button>
                <Button
                  disabled={
                    archiveAllowed.disabled || currentStatus !== "Completed"
                  }
                  title={archiveAllowed.hint}
                  variant="secondary"
                  onClick={() => mutations.archive.mutate()}
                >
                  Archive
                </Button>
              </div>

              {!isConnected ? (
                <p className="text-sm text-amber-300">
                  Connect Freighter to send lifecycle transactions.
                </p>
              ) : roleData && !roleReady ? null : roleData ? (
                <p className="text-xs text-muted">
                  Roles — Funder: {roleData.funder ? "yes" : "no"} · Grantee:{" "}
                  {roleData.grantee ? "yes" : "no"} · Arbiter:{" "}
                  {roleData.arbiter ? "yes" : "no"}
                </p>
              ) : null}

              {anyMutating ? (
                <p className="text-sm text-muted">
                  Waiting for wallet signature and confirmation...
                </p>
              ) : null}

              {actionError ? (
                <p className="text-sm text-red-300">
                  {parseContractErrorMessage(actionError)}
                </p>
              ) : null}
            </div>
          ) : (
            <EmptyState
              title="No agreement loaded"
              description="Select an agreement from the table or deploy a new one."
            />
          )}
        </Card>

        <Card>
          <CardHeader
            title="Milestone Progress"
            description={`${completedMilestones} of ${milestoneCount} completed`}
          />
          <div className="space-y-3">
            <ProgressBar value={progress} />
            <p className="font-mono text-sm font-medium text-muted">
              {Math.round(progress)}%
            </p>
          </div>
          {agreement.data ? (
            <div className="mt-4 rounded-xl border border-outline/60 bg-surface-low p-3 text-sm text-muted">
              On-chain status:{" "}
              <span className="font-mono text-foreground">{currentStatus}</span>
            </div>
          ) : null}
        </Card>
      </section>

      <Card>
        <CardHeader
          title="Milestones"
          description="Loaded from contract storage. Donations send real XLM on testnet to the grantee."
        />
        {donationNotice ? (
          <div className="mb-4 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 font-mono text-sm text-primary">
            {donationNotice}
          </div>
        ) : null}

        {milestones.isLoading ? (
          <p className="text-sm text-muted">Loading milestones...</p>
        ) : milestones.error ? (
          <EmptyState
            title="Milestones unavailable"
            description={parseContractErrorMessage(milestones.error)}
          />
        ) : milestoneList.length === 0 ? (
          <EmptyState
            title="No milestones"
            description="This agreement has no milestones on-chain."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {milestoneList.map((milestone) => {
              const tag = enumTag(milestone.status);
              const submitAllowed =
                isConnected &&
                Boolean(roleData?.grantee) &&
                currentStatus === "Active" &&
                tag === "Pending";
              const reviewAllowed =
                isConnected &&
                Boolean(roleData?.arbiter) &&
                currentStatus === "Active" &&
                tag === "Submitted";
              const finishAllowed =
                isConnected &&
                Boolean(roleData?.arbiter) &&
                currentStatus === "Active" &&
                tag === "Approved";

              return (
                <div
                  className="rounded-2xl border border-outline bg-surface-low p-4"
                  key={milestone.id}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold">Milestone #{milestone.id}</h3>
                    <StatusBadge status={milestone.status} />
                  </div>
                  <dl className="space-y-2 text-sm text-muted">
                    <Info
                      label="Amount"
                      value={`${formatAmount(milestone.amount)} XLM`}
                    />
                    <Info label="Metadata" value={milestone.metadata_uri} />
                    <Info
                      label="Completed"
                      value={formatUnixTime(milestone.completed_at)}
                    />
                  </dl>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      className="px-3 py-1.5"
                      disabled={!submitAllowed}
                      title={
                        !isConnected
                          ? "Connect Freighter first"
                          : !roleData?.grantee
                            ? "Requires grantee role"
                            : undefined
                      }
                      onClick={() => mutations.submitMilestone.mutate(milestone.id)}
                    >
                      Submit
                    </Button>
                    <Button
                      className="px-3 py-1.5"
                      disabled={!reviewAllowed}
                      title={
                        !roleData?.arbiter ? "Requires arbiter role" : undefined
                      }
                      onClick={() =>
                        mutations.approveMilestone.mutate(milestone.id)
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      className="px-3 py-1.5"
                      disabled={!reviewAllowed}
                      title={
                        !roleData?.arbiter ? "Requires arbiter role" : undefined
                      }
                      variant="secondary"
                      onClick={() =>
                        mutations.rejectMilestone.mutate(milestone.id)
                      }
                    >
                      Reject
                    </Button>
                    <Button
                      className="px-3 py-1.5"
                      disabled={!finishAllowed}
                      title={
                        !roleData?.arbiter ? "Requires arbiter role" : undefined
                      }
                      variant="secondary"
                      onClick={() =>
                        mutations.completeMilestone.mutate(milestone.id)
                      }
                    >
                      Complete
                    </Button>
                  </div>

                  <div className="mt-4 rounded-xl border border-outline/60 bg-background/40 p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-mono text-sm text-primary">
                          Donate to milestone
                        </p>
                        <p className="text-xs text-muted">
                          Sends XLM on testnet to{" "}
                          {shortAddress(agreement.data?.grantee)}.
                        </p>
                      </div>
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-1 font-mono text-xs text-primary">
                        XLM
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {["25", "50", "100"].map((amount) => (
                        <Button
                          className="px-3 py-1.5"
                          disabled={donate.isPending}
                          key={amount}
                          variant="ghost"
                          onClick={() => donateToMilestone(milestone.id, amount)}
                        >
                          {amount} XLM
                        </Button>
                      ))}
                      <input
                        className="w-24 rounded-lg border border-outline bg-background px-3 py-1.5 font-mono text-sm text-foreground outline-none ring-primary/30 focus:border-primary focus:ring-2"
                        inputMode="decimal"
                        onChange={(event) =>
                          setDonationAmountByMilestone((current) => ({
                            ...current,
                            [milestone.id]: event.target.value,
                          }))
                        }
                        placeholder="0.0"
                        value={donationAmountByMilestone[milestone.id] ?? ""}
                      />
                      <Button
                        className="px-3 py-1.5"
                        disabled={donate.isPending}
                        variant="secondary"
                        onClick={() =>
                          donateToMilestone(
                            milestone.id,
                            donationAmountByMilestone[milestone.id] ?? "0",
                          )
                        }
                      >
                        Donate
                      </Button>
                    </div>
                    {donate.isPending ? (
                      <p className="mt-3 text-xs text-muted">
                        Waiting for wallet signature and testnet confirmation...
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

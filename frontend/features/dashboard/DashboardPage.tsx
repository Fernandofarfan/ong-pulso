"use client";

import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { Button } from "@/components/ui/Button";
import { useAgreement } from "@/hooks/useAgreement";
import { useAgreementIndex, useAppStatus } from "@/hooks/useAgreementIndex";
import { useDonation } from "@/hooks/useDonation";
import { useWallet } from "@/hooks/useWallet";
import { getActivity, logActivity, type ActivityEntry } from "@/lib/activity";
import type { CreateAgreementInput } from "@/types/agreement";
import { exportCsv, exportJson } from "@/utils/export";
import { parseContractErrorMessage, relativeTime } from "@/utils/format";
import { AgreementIndexPanel, totalAgreementAmount } from "./AgreementIndexPanel";
import { OverviewPanel } from "./OverviewPanel";
import {
  ActivityPanel,
  DisbursementsPanel,
  OrganizationsPanel,
  SettingsPanel,
} from "./SecondaryPanels";
import { NavItem } from "./parts";
import { useCallback, useEffect, useMemo, useState } from "react";

type Section =
  | "dashboard"
  | "agreements"
  | "organizations"
  | "disbursements"
  | "activity"
  | "settings";

const sectionTitles: Record<Section, string> = {
  dashboard: "Dashboard",
  agreements: "Funding Agreements",
  organizations: "Organizations",
  disbursements: "Disbursements",
  activity: "Activity",
  settings: "Settings",
};

const mainNav: Array<{ id: Section; label: string; icon: string }> = [
  { id: "dashboard", label: "Dashboard", icon: "▦" },
  { id: "agreements", label: "Funding Agreements", icon: "▤" },
  { id: "organizations", label: "Organizations", icon: "▥" },
  { id: "disbursements", label: "Disbursements", icon: "◍" },
  { id: "activity", label: "Activity", icon: "↺" },
];

const useMutationActivity = (
  isSuccess: boolean,
  reset: () => void,
  refresh: () => void,
  title: string,
  type: ActivityEntry["type"],
) => {
  useEffect(() => {
    if (!isSuccess) return;
    logActivity({ type, title });
    refresh();
    reset();
  }, [isSuccess, reset, refresh, title, type]);
};

export function DashboardPage() {
  const {
    contractId,
    agreement,
    milestones,
    roles,
    activate,
    pause,
    resume,
    cancel,
    complete,
    archive,
    submitMilestone,
    approveMilestone,
    rejectMilestone,
    completeMilestone,
    setContractId,
  } = useAgreement();
  const { agreements: indexedAgreements, deployAgreement } = useAgreementIndex();
  const statusQuery = useAppStatus();
  const { donate } = useDonation();
  const { isConnected, address, network } = useWallet();

  const [activeSection, setActiveSection] = useState<Section>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [donationNotice, setDonationNotice] = useState<string | null>(null);
  const [activityTick, setActivityTick] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);

  const refreshActivity = useCallback(() => {
    setActivityTick((value) => value + 1);
  }, []);

  const activityFeed = useMemo(() => {
    void activityTick;
    return getActivity();
    // Re-read localStorage when the section changes so Activity reflects clears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityTick, activeSection]);

  const logAndRefresh = useCallback(
    (entry: { type: ActivityEntry["type"]; title: string; detail?: string }) => {
      logActivity(entry);
      refreshActivity();
    },
    [refreshActivity],
  );

  useMutationActivity(activate.isSuccess, () => activate.reset(), refreshActivity, "Agreement activated", "lifecycle");
  useMutationActivity(pause.isSuccess, () => pause.reset(), refreshActivity, "Agreement paused", "lifecycle");
  useMutationActivity(resume.isSuccess, () => resume.reset(), refreshActivity, "Agreement resumed", "lifecycle");
  useMutationActivity(cancel.isSuccess, () => cancel.reset(), refreshActivity, "Agreement cancelled", "lifecycle");
  useMutationActivity(complete.isSuccess, () => complete.reset(), refreshActivity, "Agreement completed", "lifecycle");
  useMutationActivity(archive.isSuccess, () => archive.reset(), refreshActivity, "Agreement archived", "lifecycle");
  useMutationActivity(submitMilestone.isSuccess, () => submitMilestone.reset(), refreshActivity, "Milestone submitted", "milestone");
  useMutationActivity(approveMilestone.isSuccess, () => approveMilestone.reset(), refreshActivity, "Milestone approved", "milestone");
  useMutationActivity(rejectMilestone.isSuccess, () => rejectMilestone.reset(), refreshActivity, "Milestone rejected", "milestone");
  useMutationActivity(completeMilestone.isSuccess, () => completeMilestone.reset(), refreshActivity, "Milestone completed", "milestone");
  useMutationActivity(donate.isSuccess, () => donate.reset(), refreshActivity, "XLM donation sent", "donation");

  const mergedActivity = useMemo(() => {
    const derived: ActivityEntry[] = (indexedAgreements.data ?? []).map(
      (item) => ({
        id: `idx-${item.contractId}`,
        type: "agreement" as const,
        title: `Agreement indexed: ${item.title}`,
        detail: item.organization,
        at: item.createdAt,
      }),
    );
    return [...activityFeed, ...derived].sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );
  }, [activityFeed, indexedAgreements.data]);

  const openSection = (section: Section) => {
    setActiveSection(section);
    setSidebarOpen(false);
  };

  const selectAgreement = (selectedContractId: string) => {
    setContractId(selectedContractId);
    logAndRefresh({
      type: "session",
      title: "Agreement selected",
      detail: selectedContractId,
    });
    setActiveSection("dashboard");
    setSidebarOpen(false);
  };

  const handleDeploy = (input: CreateAgreementInput) => {
    deployAgreement.mutate(input, {
      onSuccess: (deployedAgreement) => {
        setContractId(deployedAgreement.contractId);
        setActiveSection("dashboard");
      },
    });
  };

  const handleExport = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    const items = indexedAgreements.data ?? [];

    if (activeSection === "organizations") {
      const map = new Map<string, { organization: string; agreements: number; funds: number }>();
      for (const item of items) {
        const row = map.get(item.organization) ?? {
          organization: item.organization,
          agreements: 0,
          funds: 0,
        };
        row.agreements += 1;
        row.funds += totalAgreementAmount(item);
        map.set(item.organization, row);
      }
      exportCsv(`organizations-${stamp}.csv`, [...map.values()]);
      return;
    }

    if (activeSection === "disbursements") {
      const rows = (milestones.data ?? []).map((milestone) => ({
        id: milestone.id,
        amount: String(milestone.amount),
        status: typeof milestone.status === "string" ? milestone.status : milestone.status?.tag,
        metadataUri: milestone.metadata_uri,
      }));
      exportCsv(`disbursements-${stamp}.csv`, rows);
      return;
    }

    if (activeSection === "activity") {
      exportJson(`activity-${stamp}.json`, mergedActivity);
      return;
    }

    if (activeSection === "dashboard") {
      exportJson(`dashboard-${stamp}.json`, {
        contractId,
        agreement: agreement.data ?? null,
        milestones: milestones.data ?? null,
        indexedAgreements: items,
        exportedAt: new Date().toISOString(),
      });
      return;
    }

    exportCsv(
      `agreements-${stamp}.csv`,
      items.map((item) => ({
        title: item.title,
        organization: item.organization,
        contractId: item.contractId,
        network: item.network,
        milestones: item.milestones.length,
        amount: totalAgreementAmount(item),
        createdAt: item.createdAt,
      })),
    );
  };

  const indexed = indexedAgreements.data ?? [];

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="border-b border-outline p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-on-primary shadow-[0_0_18px_rgba(137,206,255,0.25)]">
            <span className="text-lg font-bold">⬡</span>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-[-0.01em]">
              Aestrial Impact Protocol
            </h1>
            <p className="text-sm text-muted">Institutional Funding</p>
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto py-4">
        {mainNav.map((item) => (
          <NavItem
            active={activeSection === item.id}
            icon={item.icon}
            key={item.id}
            label={item.label}
            onSelect={() => openSection(item.id)}
          />
        ))}
      </nav>

      <div className="border-t border-outline p-4">
        <NavItem
          active={activeSection === "settings"}
          icon="⚙"
          label="Settings"
          onSelect={() => openSection("settings")}
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed left-0 top-0 z-50 hidden h-screen w-[280px] flex-col border-r border-outline bg-surface md:flex">
        {sidebar}
      </aside>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-black/60"
            onClick={() => setSidebarOpen(false)}
            type="button"
          />
          <aside className="absolute left-0 top-0 h-full w-[280px] border-r border-outline bg-surface">
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="min-h-screen md:ml-[280px]">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-outline bg-background/80 px-4 backdrop-blur-md md:px-6">
          <div className="flex items-center gap-3">
            <button
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-outline bg-surface-high text-lg text-foreground md:hidden"
              onClick={() => setSidebarOpen(true)}
              type="button"
              aria-label="Open menu"
            >
              ☰
            </button>
            <div className="flex items-center gap-2 md:hidden">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-on-primary">
                ⬡
              </div>
              <span className="font-semibold">Aestrial</span>
            </div>
          </div>

          <div className="hidden w-72 md:block">
            <input
              className="w-full rounded-lg border border-outline bg-surface-low px-4 py-2 font-mono text-sm text-foreground outline-none ring-primary/30 placeholder:text-muted focus:border-primary focus:ring-2"
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search ${sectionTitles[activeSection].toLowerCase()}...`}
              value={search}
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                aria-label="Notifications"
                className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-outline bg-surface-high text-lg text-foreground transition hover:border-primary/60 hover:text-primary"
                onClick={() => setBellOpen((value) => !value)}
                type="button"
              >
                ♢
                {mergedActivity.length > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[10px] font-bold text-on-primary">
                    {mergedActivity.length > 9 ? "9+" : mergedActivity.length}
                  </span>
                ) : null}
              </button>
              {bellOpen ? (
                <>
                  <button
                    aria-label="Close notifications"
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setBellOpen(false)}
                    type="button"
                  />
                  <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-outline bg-surface p-3 shadow-2xl">
                    <p className="mb-2 font-mono text-xs uppercase tracking-[0.08em] text-muted">
                      Recent activity
                    </p>
                    {mergedActivity.length === 0 ? (
                      <p className="py-3 text-sm text-muted">
                        No activity yet.
                      </p>
                    ) : (
                      <div className="max-h-72 space-y-3 overflow-y-auto">
                        {mergedActivity.slice(0, 8).map((entry) => (
                          <div key={entry.id} className="text-sm">
                            <p className="font-medium text-foreground">
                              {entry.title}
                            </p>
                            {entry.detail ? (
                              <p className="text-xs text-muted">
                                {entry.detail}
                              </p>
                            ) : null}
                            <span className="font-mono text-xs text-muted">
                              {relativeTime(entry.at)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
            <ConnectWalletButton />
            <div
              className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-outline bg-gradient-to-br from-primary/60 to-primary/10 font-mono text-xs font-bold text-foreground transition hover:border-primary"
              title={address ? `Connected: ${address}` : "Not connected"}
            >
              {address ? address.slice(0, 2) : "GU"}
            </div>
          </div>
        </header>

        {network && !/testnet/i.test(network) ? (
          <div className="border-b border-amber-400/40 bg-amber-400/10 px-4 py-2 text-center text-sm text-amber-200 md:px-6">
            Freighter is on <span className="font-mono">{network}</span> — this
            app runs on Stellar Testnet. Switch the network in Freighter to sign
            transactions.
          </div>
        ) : null}

        <div className="border-b border-outline px-4 py-2 md:hidden">
          <input
            className="w-full rounded-lg border border-outline bg-surface-low px-4 py-2 font-mono text-sm text-foreground outline-none ring-primary/30 placeholder:text-muted focus:border-primary focus:ring-2"
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Search ${sectionTitles[activeSection].toLowerCase()}...`}
            value={search}
          />
        </div>

        <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-4 py-6 md:px-6 xl:px-8">
          <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="font-mono text-sm tracking-[0.18em] text-primary">
                STELLAR AGREEMENTS
              </p>
              <h2 className="mt-2 text-4xl font-bold tracking-[-0.02em] md:text-5xl">
                {sectionTitles[activeSection]}
              </h2>
              <p className="mt-2 flex items-center gap-2 text-lg text-muted">
                Funding agreements powered by
                <span className="rounded border border-outline bg-surface-high px-2 py-0.5 font-mono text-sm text-foreground">
                  Stellar
                </span>
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleExport} variant="secondary">
                Export
              </Button>
              <Button
                onClick={() => openSection("agreements")}
              >
                New Agreement
              </Button>
            </div>
          </section>

          {deployAgreement.error ? (
            <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
              {parseContractErrorMessage(deployAgreement.error)}
            </div>
          ) : null}

          {activeSection === "dashboard" ? (
            <OverviewPanel
              agreement={{
                data: agreement.data,
                isLoading: agreement.isLoading,
                error: agreement.error,
              }}
              contractId={contractId}
              donate={donate}
              donationNotice={donationNotice}
              indexedAgreements={indexed}
              isConnected={isConnected}
              activity={mergedActivity}
              milestones={{
                data: milestones.data,
                isLoading: milestones.isLoading,
                error: milestones.error,
              }}
              mutations={{
                activate,
                pause,
                resume,
                cancel,
                complete,
                archive,
                submitMilestone,
                approveMilestone,
                rejectMilestone,
                completeMilestone,
              }}
              onGoToAgreements={() => openSection("agreements")}
              onSelectAgreement={selectAgreement}
              roles={{
                data: roles.data,
                isLoading: roles.isLoading,
              }}
              search={search}
              setDonationNotice={setDonationNotice}
            />
          ) : null}

          {activeSection === "agreements" ? (
            <AgreementIndexPanel
              agreements={indexed}
              deployError={deployAgreement.error}
              deployPending={deployAgreement.isPending}
              deploySuccess={deployAgreement.isSuccess}
              isLoading={indexedAgreements.isLoading}
              loadError={indexedAgreements.error}
              onDeploy={handleDeploy}
              onSelectAgreement={selectAgreement}
              search={search}
            />
          ) : null}

          {activeSection === "organizations" ? (
            <OrganizationsPanel
              agreements={indexed}
              onSelectAgreement={selectAgreement}
              search={search}
            />
          ) : null}

          {activeSection === "disbursements" ? (
            <DisbursementsPanel
              contractId={contractId}
              error={milestones.error}
              isLoading={milestones.isLoading}
              milestones={milestones.data?.map((milestone) => ({
                id: milestone.id,
                amount: String(milestone.amount),
                metadataUri: milestone.metadata_uri,
                status:
                  typeof milestone.status === "string"
                    ? milestone.status
                    : milestone.status?.tag,
                completedAt:
                  milestone.completed_at != null
                    ? new Date(Number(milestone.completed_at) * 1000).toISOString()
                    : null,
              }))}
            />
          ) : null}

          {activeSection === "activity" ? (
            <ActivityPanel
              agreements={indexed}
              onCleared={refreshActivity}
              search={search}
              storageVersion={activityTick}
            />
          ) : null}

          {activeSection === "settings" ? (
            <SettingsPanel
              status={statusQuery.data}
              statusError={statusQuery.error}
              statusLoading={statusQuery.isLoading}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}

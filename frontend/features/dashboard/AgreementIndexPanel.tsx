"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState, Field, NetworkBadge, RowCard } from "./parts";
import { useWallet } from "@/hooks/useWallet";
import type { CreateAgreementInput, IndexedAgreement, IndexedMilestone } from "@/types/agreement";
import { shortAddress } from "@/utils/format";
import { type FormEvent, useMemo, useState } from "react";

type AgreementSort = "newest" | "oldest" | "title" | "organization";

export function AgreementIndexPanel({
  agreements,
  isLoading,
  loadError,
  onDeploy,
  deployError,
  deployPending,
  deploySuccess,
  onSelectAgreement,
  search,
}: {
  agreements: IndexedAgreement[];
  isLoading: boolean;
  loadError: unknown;
  onDeploy: (input: CreateAgreementInput) => void;
  deployError: unknown;
  deployPending: boolean;
  deploySuccess: boolean;
  onSelectAgreement: (contractId: string) => void;
  search: string;
}) {
  const [sortBy, setSortBy] = useState<AgreementSort>("newest");
  const { address: walletAddress } = useWallet();
  const [form, setForm] = useState<CreateAgreementInput>({
    contractId: "",
    title: "",
    organization: "",
    metadataUri: "ipfs://agreement",
    funder: "",
    grantee: "",
    arbiter: "",
    network: "testnet",
    milestones: [{ id: 0, amount: "100", metadataUri: "ipfs://milestone-0" }],
  });
  const [formNotice, setFormNotice] = useState<string | null>(null);

  const updateField = (field: keyof CreateAgreementInput, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateMilestone = (
    index: number,
    field: "amount" | "metadataUri",
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      milestones: current.milestones.map((milestone, currentIndex) =>
        currentIndex === index ? { ...milestone, [field]: value } : milestone,
      ),
    }));
  };

  const addMilestone = () => {
    setForm((current) => ({
      ...current,
      milestones: [
        ...current.milestones,
        {
          id: current.milestones.length,
          amount: "100",
          metadataUri: `ipfs://milestone-${current.milestones.length}`,
        },
      ],
    }));
  };

  const removeMilestone = (index: number) => {
    setForm((current) => {
      const next = current.milestones
        .filter((_, currentIndex) => currentIndex !== index)
        .map((milestone, currentIndex) => ({
          ...milestone,
          id: currentIndex,
          metadataUri: milestone.metadataUri.replace(
            /milestone-\d+/,
            `milestone-${currentIndex}`,
          ),
        }));
      return { ...current, milestones: next };
    });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormNotice(null);

    if (!form.title.trim() || !form.organization.trim()) {
      setFormNotice("Title and organization are required.");
      return;
    }
    if (form.milestones.length === 0) {
      setFormNotice("Add at least one milestone.");
      return;
    }
    if (
      form.milestones.some(
        (milestone) => !milestone.amount || !Number.isInteger(Number(milestone.amount)) || Number(milestone.amount) <= 0,
      )
    ) {
      setFormNotice("Milestone amounts must be positive integers.");
      return;
    }

    onDeploy({
      ...form,
      title: form.title.trim(),
      organization: form.organization.trim(),
      // Empty role fields fall back to the connected wallet so the deployed
      // contract is actionable by the demo user (otherwise the deployer
      // account owns every role).
      funder: form.funder.trim() || walletAddress || "",
      grantee: form.grantee.trim() || walletAddress || "",
      arbiter: form.arbiter.trim() || walletAddress || "",
      milestones: form.milestones.map((milestone, index) => ({
        ...milestone,
        id: index,
      })),
    });
  };

  const sortedAgreements = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = query
      ? agreements.filter(
          (agreement) =>
            agreement.title.toLowerCase().includes(query) ||
            agreement.organization.toLowerCase().includes(query) ||
            agreement.contractId.toLowerCase().includes(query),
        )
      : agreements;

    const items = [...filtered];
    switch (sortBy) {
      case "oldest":
        return items.sort(
          (a, b) =>
            new Date(a.createdAt ?? 0).getTime() -
            new Date(b.createdAt ?? 0).getTime(),
        );
      case "title":
        return items.sort((a, b) => a.title.localeCompare(b.title));
      case "organization":
        return items.sort((a, b) =>
          a.organization.localeCompare(b.organization),
        );
      case "newest":
      default:
        return items.sort(
          (a, b) =>
            new Date(b.createdAt ?? 0).getTime() -
            new Date(a.createdAt ?? 0).getTime(),
        );
    }
  }, [agreements, sortBy, search]);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
      <Card>
        <CardHeader
          title="Funding Agreements"
          description="Indexed deployed agreement contract IDs."
        />
        {isLoading ? (
          <p className="text-sm text-muted">Loading index...</p>
        ) : null}
        {loadError ? (
          <div className="mb-4 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            {loadError instanceof Error
              ? loadError.message
              : "Agreement index unavailable."}
          </div>
        ) : null}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-muted">
            {sortedAgreements.length} agreement
            {sortedAgreements.length === 1 ? "" : "s"}
            {search.trim() ? " (filtered)" : ""}
          </p>
          <label className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-[0.08em] text-muted">
              Sort
            </span>
            <select
              className="rounded-lg border border-outline bg-background px-3 py-1.5 font-mono text-sm text-foreground outline-none ring-primary/30 focus:border-primary focus:ring-2"
              onChange={(event) =>
                setSortBy(event.target.value as AgreementSort)
              }
              value={sortBy}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="title">Title A–Z</option>
              <option value="organization">Organization A–Z</option>
            </select>
          </label>
        </div>
        <div className="space-y-3">
          {sortedAgreements.length > 0 ? (
            sortedAgreements.map((agreement) => (
              <div key={agreement.contractId} className="relative">
                <RowCard
                  title={agreement.title}
                  subtitle={`${agreement.organization} · ${agreement.milestones.length} milestones`}
                  meta={shortAddress(agreement.contractId)}
                  onSelect={() => onSelectAgreement(agreement.contractId)}
                  trailing={<NetworkBadge network={agreement.network} />}
                />
              </div>
            ))
          ) : (
            <EmptyState
              title={search.trim() ? "No matches" : "No agreements indexed yet"}
              description={
                search.trim()
                  ? "Try a different search term."
                  : "Deploy one using the form on the right."
              }
            />
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Create New Agreement"
          description="Deploy, initialize, recover the contract id and index it."
        />
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-3 md:grid-cols-2">
            <Field
              label="Title"
              onChange={(value) => updateField("title", value)}
              placeholder="Water Access Cohort"
              value={form.title}
            />
            <Field
              label="Organization"
              onChange={(value) => updateField("organization", value)}
              placeholder="Pulso Foundation"
              value={form.organization}
            />
            <Field
              label="Metadata URI"
              onChange={(value) => updateField("metadataUri", value)}
              placeholder="ipfs://agreement"
              value={form.metadataUri}
            />
            <Field
              label="Funder"
              onChange={(value) => updateField("funder", value)}
              placeholder={
                walletAddress ? `defaults to ${shortAddress(walletAddress)}` : "G... address (defaults to wallet)"
              }
              value={form.funder}
            />
            <Field
              label="Arbiter"
              onChange={(value) => updateField("arbiter", value)}
              placeholder={
                walletAddress ? `defaults to ${shortAddress(walletAddress)}` : "G... address (defaults to wallet)"
              }
              value={form.arbiter}
            />
            <Field
              label="Donation Receiver (Grantee)"
              onChange={(value) => updateField("grantee", value)}
              placeholder={
                walletAddress ? `defaults to ${shortAddress(walletAddress)}` : "G... address (defaults to wallet)"
              }
              value={form.grantee}
            />
          </div>
          <p className="text-sm text-muted">
            Leave a role empty to use your connected Freighter address — that
            way you can activate, submit and approve your own agreement in the
            demo. Factory defaults to OWNER_ADDRESS from the root .env.
          </p>

          <div className="rounded-2xl border border-outline bg-surface-low p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Milestones</h3>
              <Button type="button" variant="secondary" onClick={addMilestone}>
                Add Milestone
              </Button>
            </div>
            <div className="space-y-3">
              {form.milestones.map((milestone, index) => (
                <div
                  className="grid gap-3 md:grid-cols-[64px_1fr_1fr_auto]"
                  key={milestone.id}
                >
                  <Field label="ID" readOnly value={String(index)} />
                  <Field
                    label="Amount"
                    onChange={(value) => updateMilestone(index, "amount", value)}
                    value={milestone.amount}
                  />
                  <Field
                    label="Metadata URI"
                    onChange={(value) =>
                      updateMilestone(index, "metadataUri", value)
                    }
                    value={milestone.metadataUri}
                  />
                  <Button
                    className="self-end"
                    disabled={form.milestones.length === 1}
                    type="button"
                    variant="ghost"
                    onClick={() => removeMilestone(index)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={deployPending} type="submit">
              {deployPending ? "Deploying..." : "Deploy + Initialize + Index"}
            </Button>
            {deploySuccess ? (
              <span className="font-mono text-sm text-primary">
                Agreement deployed, initialized and indexed.
              </span>
            ) : null}
          </div>
          {formNotice ? (
            <span className="block text-sm text-amber-300">{formNotice}</span>
          ) : null}
          {deployError ? (
            <span className="block text-sm text-red-300">
              {deployError instanceof Error
                ? deployError.message
                : "Unable to deploy agreement"}
            </span>
          ) : null}
        </form>
      </Card>
    </div>
  );
}

export function totalAgreementAmount(agreement: IndexedAgreement): number {
  return agreement.milestones.reduce(
    (sum: number, milestone: IndexedMilestone) =>
      sum + (Number(milestone.amount) || 0),
    0,
  );
}

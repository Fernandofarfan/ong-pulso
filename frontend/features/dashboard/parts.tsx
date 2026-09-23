import type { ReactNode } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";

export function NavItem({
  label,
  icon,
  active = false,
  onSelect,
}: {
  label: string;
  icon: string;
  active?: boolean;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-center gap-3 border-l-4 px-4 py-2 transition ${
        active
          ? "border-primary bg-surface-highest text-primary"
          : "border-transparent text-muted hover:border-outline hover:bg-surface-high"
      }`}
    >
      <span className="font-mono text-lg">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="glass-panel subtle-gradient rounded-2xl p-5 transition hover:border-primary/60">
      <p className="font-mono text-sm tracking-[0.02em] text-muted">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-[-0.02em] text-foreground">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 font-mono text-xs text-primary">{hint}</p>
      ) : null}
    </div>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  readOnly = false,
  type = "text",
  suppressHydrationWarning = false,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  type?: string;
  suppressHydrationWarning?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-xs uppercase tracking-[0.08em] text-muted">
        {label}
      </span>
      <input
        className="w-full rounded-lg border border-outline bg-background px-3 py-2 font-mono text-sm text-foreground outline-none ring-primary/30 transition placeholder:text-muted/50 focus:border-primary focus:ring-2 read-only:text-muted"
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        placeholder={placeholder}
        readOnly={readOnly}
        suppressHydrationWarning={suppressHydrationWarning}
        type={type}
        value={value}
      />
    </label>
  );
}

export function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 rounded-xl border border-outline/60 bg-surface-low px-3 py-2">
      <dt className="text-muted">{label}</dt>
      <dd className="truncate text-right font-mono text-sm font-medium text-foreground">
        {value}
      </dd>
    </div>
  );
}

export function RowCard({
  title,
  subtitle,
  meta,
  status,
  onSelect,
  trailing,
}: {
  title: string;
  subtitle: string;
  meta: string;
  status?: string;
  onSelect?: () => void;
  trailing?: ReactNode;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {trailing}
          {status ? <StatusBadge status={status} /> : null}
        </div>
      </div>
      <p className="mt-3 font-mono text-sm text-primary">{meta}</p>
    </>
  );

  if (onSelect) {
    return (
      <button
        className="w-full rounded-xl border border-outline/60 bg-surface-low p-4 text-left transition hover:border-primary/50"
        type="button"
        onClick={onSelect}
      >
        {content}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-outline/60 bg-surface-low p-4 transition hover:border-primary/50">
      {content}
    </div>
  );
}

export function NetworkBadge({ network }: { network: string }) {
  const label = network === "mainnet" ? "Mainnet" : "Testnet";
  return (
    <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 font-mono text-xs font-medium tracking-[0.04em] text-sky-300">
      {label}
    </span>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-outline/70 bg-surface-low px-4 py-8 text-center">
      <p className="font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted">{description}</p>
    </div>
  );
}

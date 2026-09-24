import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center text-foreground">
      <p className="font-mono text-sm tracking-[0.18em] text-primary">
        STELLAR AGREEMENTS
      </p>
      <h1 className="text-4xl font-bold tracking-[-0.02em]">404</h1>
      <p className="text-muted">
        This page does not exist. The dashboard lives at the home route.
      </p>
      <Link
        className="rounded-lg bg-primary px-5 py-2.5 font-medium text-on-primary transition hover:opacity-90"
        href="/"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}

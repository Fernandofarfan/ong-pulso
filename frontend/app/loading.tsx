export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-outline border-t-primary" />
      <p className="font-mono text-sm text-muted">Loading dashboard...</p>
    </div>
  );
}

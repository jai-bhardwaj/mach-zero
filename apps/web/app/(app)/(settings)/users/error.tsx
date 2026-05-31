"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold tracking-tight">Users</h1>
      <div className="rounded-lg border border-red-500/30 bg-red-900/10 p-6">
        <h2 className="font-semibold text-red-400">Failed to load users</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={reset}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

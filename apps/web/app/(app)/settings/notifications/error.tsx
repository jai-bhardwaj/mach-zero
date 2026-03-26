"use client";

export default function NotificationsError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="p-6">
      <div className="rounded-lg border border-red-500/30 bg-red-900/20 p-6">
        <h2 className="font-semibold text-red-400">Notifications Error</h2>
        <p className="mt-2 text-sm text-zinc-400">{error.message}</p>
        <button
          onClick={reset}
          className="mt-4 rounded-md bg-accent px-4 py-2 text-sm text-white hover:bg-accent/80"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="mx-auto max-w-md space-y-4 rounded-lg border border-red-500/30 bg-red-900/10 p-8 text-center">
          <h2 className="text-lg font-semibold text-red-400">
            Something went wrong
          </h2>
          <p className="text-sm text-muted-foreground">{error.message}</p>
          <button
            onClick={reset}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

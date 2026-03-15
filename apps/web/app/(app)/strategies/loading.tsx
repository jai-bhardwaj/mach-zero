export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* PageHeader */}
      <div className="border-b border-border/50 pb-4 mb-6">
        <div className="h-5 w-32 rounded bg-muted" />
      </div>

      {/* Capital section */}
      <div className="rounded-lg border border-border/50 p-4 space-y-2">
        <div className="h-3 w-24 rounded bg-muted" />
        <div className="h-6 w-32 rounded bg-muted" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-8 w-24 rounded bg-muted" />
        ))}
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-lg border border-border/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-4 w-28 rounded bg-muted" />
              <div className="h-5 w-16 rounded bg-muted" />
            </div>
            <div className="h-3 w-full rounded bg-muted" />
            <div className="h-3 w-3/4 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* PageHeader */}
      <div className="border-b border-border/50 pb-4 mb-6">
        <div className="h-5 w-32 rounded bg-muted" />
      </div>

      {/* MetricStrip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-2 p-3">
            <div className="h-3 w-16 rounded bg-muted" />
            <div className="h-6 w-20 rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Table section */}
      <div className="space-y-2">
        <div className="h-4 w-28 rounded bg-muted" />
        <div className="rounded-lg border border-border/50 p-4 space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-8 rounded bg-muted" />
          ))}
        </div>
      </div>

      {/* Chart section */}
      <div className="space-y-2">
        <div className="h-4 w-24 rounded bg-muted" />
        <div className="h-56 rounded-lg border border-border/50 bg-muted" />
      </div>

      {/* Market data section */}
      <div className="space-y-2">
        <div className="h-4 w-28 rounded bg-muted" />
        <div className="h-40 rounded-lg border border-border/50 bg-muted" />
      </div>
    </div>
  );
}

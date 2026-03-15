export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* PageHeader with period selector */}
      <div className="flex items-center justify-between border-b border-border/50 pb-4 mb-6">
        <div className="h-5 w-24 rounded bg-muted" />
        <div className="h-8 w-28 rounded bg-muted" />
      </div>

      {/* Section 1: Performance */}
      <div className="space-y-4">
        {/* MetricStrip */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2 p-3">
              <div className="h-3 w-16 rounded bg-muted" />
              <div className="h-6 w-20 rounded bg-muted" />
            </div>
          ))}
        </div>
        {/* Chart */}
        <div className="h-64 rounded-lg border border-border/50 bg-muted" />
      </div>

      {/* Section 2: Execution */}
      <div className="space-y-4">
        <div className="h-4 w-36 rounded bg-muted" />
        {/* MetricStrip */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2 p-3">
              <div className="h-3 w-16 rounded bg-muted" />
              <div className="h-6 w-20 rounded bg-muted" />
            </div>
          ))}
        </div>
        {/* Chart */}
        <div className="h-64 rounded-lg border border-border/50 bg-muted" />
      </div>

      {/* Section 3: Volume */}
      <div className="space-y-4">
        <div className="h-4 w-36 rounded bg-muted" />
        {/* MetricStrip */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2 p-3">
              <div className="h-3 w-16 rounded bg-muted" />
              <div className="h-6 w-20 rounded bg-muted" />
            </div>
          ))}
        </div>
        {/* Chart */}
        <div className="h-64 rounded-lg border border-border/50 bg-muted" />
      </div>
    </div>
  );
}

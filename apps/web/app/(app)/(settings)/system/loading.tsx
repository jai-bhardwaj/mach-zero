export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* PageHeader */}
      <div className="border-b border-border/50 pb-4 mb-6">
        <div className="h-5 w-24 rounded bg-muted" />
      </div>

      {/* Status dot */}
      <div className="flex items-center gap-2">
        <div className="h-3 w-3 rounded-full bg-muted" />
        <div className="h-4 w-24 rounded bg-muted" />
      </div>

      {/* 3-col grid of border boxes */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-lg border border-border/50 p-4 space-y-3">
            <div className="h-4 w-28 rounded bg-muted" />
            <div className="h-3 w-full rounded bg-muted" />
            <div className="h-3 w-2/3 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

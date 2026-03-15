export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* PageHeader with description */}
      <div className="border-b border-border/50 pb-4 mb-6">
        <div className="h-5 w-48 rounded bg-muted" />
        <div className="mt-2 h-3 w-72 rounded bg-muted" />
      </div>

      {/* Template cards grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-lg border border-border/50 p-4 space-y-3">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="h-3 w-full rounded bg-muted" />
            <div className="h-3 w-3/4 rounded bg-muted" />
            <div className="flex gap-2 pt-2">
              <div className="h-5 w-14 rounded bg-muted" />
              <div className="h-5 w-14 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* PageHeader */}
      <div className="border-b border-border/50 pb-4 mb-6">
        <div className="h-5 w-24 rounded bg-muted" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-8 w-24 rounded bg-muted" />
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-48 rounded bg-muted" />
        <div className="h-9 w-24 rounded bg-muted" />
        <div className="h-9 w-24 rounded bg-muted" />
      </div>

      {/* Table rows */}
      <div className="space-y-2">
        <div className="h-10 rounded bg-muted" />
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-10 rounded bg-muted" />
        ))}
      </div>
    </div>
  );
}

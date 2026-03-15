export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* PageHeader */}
      <div className="border-b border-border/50 pb-4 mb-6">
        <div className="h-5 w-24 rounded bg-muted" />
      </div>

      {/* Table rows */}
      <div className="space-y-2">
        <div className="h-10 rounded bg-muted" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-10 rounded bg-muted" />
        ))}
      </div>
    </div>
  );
}

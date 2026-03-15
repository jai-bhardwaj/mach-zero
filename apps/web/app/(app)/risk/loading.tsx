export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* PageHeader */}
      <div className="border-b border-border/50 pb-4 mb-6">
        <div className="h-5 w-36 rounded bg-muted" />
      </div>

      {/* Kill switch panel */}
      <div className="rounded-lg border border-border/50 p-4 space-y-3">
        <div className="h-4 w-24 rounded bg-muted" />
        <div className="h-8 w-32 rounded bg-muted" />
      </div>

      {/* Square off panel */}
      <div className="rounded-lg border border-border/50 p-4 space-y-3">
        <div className="h-4 w-28 rounded bg-muted" />
        <div className="flex gap-3">
          <div className="h-9 w-28 rounded bg-muted" />
          <div className="h-9 w-28 rounded bg-muted" />
        </div>
      </div>

      {/* 2-col grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border/50 p-4 space-y-2">
          <div className="h-4 w-24 rounded bg-muted" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-8 rounded bg-muted" />
          ))}
        </div>
        <div className="rounded-lg border border-border/50 p-4 space-y-2">
          <div className="h-4 w-24 rounded bg-muted" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-8 rounded bg-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}

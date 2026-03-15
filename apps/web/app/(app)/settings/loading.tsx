export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* PageHeader with description */}
      <div className="border-b border-border/50 pb-4 mb-6">
        <div className="h-5 w-28 rounded bg-muted" />
        <div className="mt-2 h-3 w-56 rounded bg-muted" />
      </div>

      {/* 3 stacked card sections, centered */}
      <div className="mx-auto max-w-2xl space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-lg border border-border/50 p-6 space-y-3">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="h-3 w-full rounded bg-muted" />
            <div className="h-3 w-2/3 rounded bg-muted" />
            <div className="h-9 w-24 rounded bg-muted mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BacktestLoading() {
  return (
    <div className="animate-pulse space-y-6 p-6">
      <div className="h-7 w-32 rounded bg-zinc-800" />
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 rounded bg-zinc-800" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-zinc-800" />
        ))}
      </div>
      <div className="h-64 rounded-lg bg-zinc-800" />
    </div>
  );
}

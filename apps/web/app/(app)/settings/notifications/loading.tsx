export default function NotificationsLoading() {
  return (
    <div className="animate-pulse space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="h-7 w-36 rounded bg-zinc-800" />
        <div className="h-8 w-24 rounded bg-zinc-800" />
      </div>
      <div className="flex gap-1 rounded-lg bg-zinc-900 p-1">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-8 flex-1 rounded-md bg-zinc-800" />
        ))}
      </div>
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-14 rounded-lg bg-zinc-800" />
        ))}
      </div>
    </div>
  );
}

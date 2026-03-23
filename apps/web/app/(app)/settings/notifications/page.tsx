import { Suspense } from "react";
import { NotificationsClient } from "@/components/notifications/NotificationsClient";

export default function NotificationsPage() {
  return (
    <Suspense
      fallback={
        <div className="animate-pulse space-y-4 p-6">
          <div className="h-8 w-48 rounded bg-zinc-800" />
          <div className="h-64 rounded-lg bg-zinc-800" />
        </div>
      }
    >
      <NotificationsClient />
    </Suspense>
  );
}

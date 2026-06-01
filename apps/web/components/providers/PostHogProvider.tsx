"use client";

// Client-side PostHog initialization. Wrapped so that:
//   - When NEXT_PUBLIC_POSTHOG_KEY is unset, no script loads, no
//     network calls, no exceptions. Dev/test stays quiet.
//   - When the user's session is available, we identify() with the
//     user's id so server-side and client-side events share a
//     distinctId.

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import posthog from "posthog-js";

let _initialized = false;

function initPostHogOnce() {
  if (_initialized) return;
  _initialized = true;

  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!apiKey) return;

  posthog.init(apiKey, {
    api_host:
      process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    // Autocapture page views, clicks, form submissions — gives us the
    // raw funnel data without instrumenting every component.
    autocapture: true,
    capture_pageview: true,
    capture_pageleave: true,
    // Persist via localStorage so anonymous-then-signed-in users can
    // be linked across sessions.
    persistence: "localStorage+cookie",
    // Don't capture sensitive form fields. NextAuth magic-link emails
    // and API keys must never reach analytics.
    mask_all_text: false,
  });
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  useEffect(() => {
    initPostHogOnce();
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

    if (status === "authenticated" && session?.user) {
      const u = session.user as unknown as Record<string, unknown>;
      const userId = u.id as string | undefined;
      if (userId) {
        posthog.identify(userId, {
          email: u.email as string | undefined,
          tenantId: u.tenantId as string | undefined,
          tenantName: u.tenantName as string | undefined,
          role: u.role as string | undefined,
          engineId: u.engineId as number | undefined,
        });
      }
    } else if (status === "unauthenticated") {
      posthog.reset();
    }
  }, [session, status]);

  return <>{children}</>;
}

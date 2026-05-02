// Server-side analytics for the onboarding funnel.
//
// Wraps PostHog so that:
//   - When POSTHOG_KEY is unset (dev, CI), every call is a noop.
//     No-config-required by design — analytics should never block
//     a code path or fail a test.
//   - In production, events are best-effort (errors are swallowed and
//     logged).
//
// Critical onboarding events to instrument:
//   - workspace_created
//   - account_connected
//   - account_validated (with canWithdraw — answers "are users
//     pasting dangerous keys?")
//   - strategy_subscribed (first activation)
//   - onboarding_completed
//
// User properties to set on identify: engineId, role, tenantName.
//
// Server-side tracking is preferred over client-side for these events
// because:
//   - It's resilient to ad-blockers
//   - We can attribute events to authenticated users without trusting
//     a client-side identify call
//   - The events are tied to actual mutations succeeding, not just
//     button clicks

import 'server-only';
import { PostHog } from 'posthog-node';

let _client: PostHog | null = null;
let _initialized = false;

function getClient(): PostHog | null {
  if (_initialized) return _client;
  _initialized = true;

  const apiKey = process.env.POSTHOG_KEY;
  if (!apiKey) return null;

  _client = new PostHog(apiKey, {
    host: process.env.POSTHOG_HOST ?? 'https://us.i.posthog.com',
    flushAt: 1,        // mutation events should fire promptly, not batch
    flushInterval: 0,
  });
  return _client;
}

export type AnalyticsEvent =
  | 'workspace_created'
  | 'account_connected'
  | 'account_validated'
  | 'strategy_subscribed'
  | 'onboarding_completed'
  | 'kill_switch_toggled'
  | 'square_off_requested'
  | 'live_mode_activated';

export interface TrackArgs {
  userId: string;
  event: AnalyticsEvent;
  properties?: Record<string, unknown>;
  // engineId / tenantId / tenantName populate $set automatically — they're
  // user properties, not event properties
  engineId?: number;
  tenantId?: string;
  tenantName?: string;
  role?: string;
}

export function track(args: TrackArgs): void {
  const client = getClient();
  if (!client) return;

  try {
    const $set: Record<string, unknown> = {};
    if (args.engineId !== undefined) $set.engineId = args.engineId;
    if (args.tenantId) $set.tenantId = args.tenantId;
    if (args.tenantName) $set.tenantName = args.tenantName;
    if (args.role) $set.role = args.role;

    client.capture({
      distinctId: args.userId,
      event: args.event,
      properties: {
        ...(args.properties ?? {}),
        ...(Object.keys($set).length > 0 ? { $set } : {}),
      },
    });
  } catch {
    // Analytics must never affect the user-visible code path.
  }
}

// Flush any pending events. Call from request shutdown if needed; not
// required for typical Vercel function lifecycles since flushAt=1.
export async function flushAnalytics(): Promise<void> {
  const client = _client;
  if (!client) return;
  try {
    await client.shutdown();
  } catch {
    // ignore
  }
}

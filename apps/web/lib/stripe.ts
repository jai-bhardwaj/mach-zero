// Stripe billing — server-only.
//
// One client per process; lazily initialized so the absence of
// STRIPE_SECRET_KEY in dev does not crash the import graph (unlike, say,
// authentication, billing is fine to be inert in a dev environment).

import 'server-only';
import Stripe from 'stripe';

let _client: Stripe | null = null;

export function getStripe(): Stripe {
  if (_client) return _client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      'STRIPE_SECRET_KEY is not set. Stripe APIs cannot be called.'
    );
  }
  _client = new Stripe(key, {
    apiVersion: '2026-04-22.dahlia',
    typescript: true,
  });
  return _client;
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET;
}

// Map Stripe price IDs to internal plan tiers. Configured at deploy time
// via env vars so we don't hard-code Stripe IDs in source. The webhook
// uses this mapping to compute the resulting Tenant.plan.
//
// Convention: STRIPE_PRICE_PRO=price_xxx, STRIPE_PRICE_ENTERPRISE=price_xxx.
import type { Plan } from '@prisma/client';

export function priceIdToPlan(priceId: string | null | undefined): Plan {
  if (!priceId) return 'FREE';
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'PRO';
  if (priceId === process.env.STRIPE_PRICE_ENTERPRISE) return 'ENTERPRISE';
  return 'FREE';
}

// Stripe subscription statuses that should grant access to the paid plan.
// `trialing` counts as active (paid plan during trial). Anything else
// (past_due, canceled, unpaid, incomplete, paused) reverts to FREE.
export function isActiveStatus(status: string): boolean {
  return status === 'active' || status === 'trialing';
}

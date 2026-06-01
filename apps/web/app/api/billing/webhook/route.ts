// POST /api/billing/webhook
// Stripe webhook receiver. Source of truth for Tenant.plan and Billing
// row state. Stripe retries webhooks for up to 3 days, so handlers must
// be idempotent.
//
// Events we care about:
//   - checkout.session.completed   → first link customer ↔ subscription
//   - customer.subscription.created
//   - customer.subscription.updated
//   - customer.subscription.deleted
//   - invoice.payment_failed       → optional: surface a past_due banner
//
// Signature verification is mandatory — without it, anyone can post to
// this endpoint and downgrade tenants.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStripe, isStripeConfigured, priceIdToPlan, isActiveStatus } from "@/lib/stripe";
import type Stripe from "stripe";

// We need the raw body for Stripe's signature verification.
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Billing not configured" },
      { status: 503 }
    );
  }

  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    return NextResponse.json(
      { error: `Signature verification failed: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await onSubscriptionChange(event.data.object as Stripe.Subscription);
        break;

      // Other events are ignored but acknowledged — Stripe stops retrying
      // after a 200.
      default:
        break;
    }
  } catch (err) {
    // Returning 5xx triggers a Stripe retry. We want that for transient
    // failures (DB unavailable) but not for malformed events.
    return NextResponse.json(
      { error: `Handler failed: ${(err as Error).message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}

async function onCheckoutCompleted(s: Stripe.Checkout.Session) {
  // tenantId set on session create; if missing, we can't link anything.
  const tenantId = s.metadata?.tenantId ?? s.client_reference_id;
  if (!tenantId || typeof s.customer !== "string") return;

  // The subscription is fetched fresh; the embedded sub in the session
  // doesn't include all the fields we need.
  const subscriptionId =
    typeof s.subscription === "string" ? s.subscription : s.subscription?.id;
  if (!subscriptionId) return;

  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  await applySubscription(tenantId, sub, s.customer);
}

async function onSubscriptionChange(sub: Stripe.Subscription) {
  if (typeof sub.customer !== "string") return;

  // Resolve tenantId from our Billing row keyed on Stripe customer id.
  const billing = await prisma.billing.findUnique({
    where: { stripeCustomerId: sub.customer },
    select: { tenantId: true },
  });
  if (!billing) return;
  await applySubscription(billing.tenantId, sub, sub.customer);
}

async function applySubscription(
  tenantId: string,
  sub: Stripe.Subscription,
  customerId: string
) {
  const item = sub.items.data[0];
  const priceId = item?.price.id ?? null;
  const newPlan = isActiveStatus(sub.status) ? priceIdToPlan(priceId) : "FREE";
  // current_period_end moved from Subscription to SubscriptionItem in
  // the 2026-04-22 Stripe API. Read from the item.
  const periodEnd = item?.current_period_end
    ? new Date(item.current_period_end * 1000)
    : null;

  await prisma.$transaction([
    prisma.billing.upsert({
      where: { tenantId },
      create: {
        tenantId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        stripePriceId: priceId,
        status: sub.status,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      },
      update: {
        stripeSubscriptionId: sub.id,
        stripePriceId: priceId,
        status: sub.status,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      },
    }),
    prisma.tenant.update({
      where: { id: tenantId },
      data: { plan: newPlan },
    }),
  ]);
}

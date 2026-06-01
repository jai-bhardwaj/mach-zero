// POST /api/billing/checkout
// Creates a Stripe Checkout Session for the requested price tier and
// returns the redirect URL. Client navigates the browser to the URL.
//
// Idempotent at the customer level: the first call creates a Stripe
// customer and stores the id in our Billing table; subsequent calls
// reuse it.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Billing is not configured for this deployment." },
      { status: 503 }
    );
  }

  const session = await requireAuth("SUPER_ADMIN", "ADMIN");
  if (isAuthError(session)) return session;

  const body = await request.json().catch(() => ({}));
  const tier = body.tier as "PRO" | "ENTERPRISE" | undefined;
  if (tier !== "PRO" && tier !== "ENTERPRISE") {
    return NextResponse.json(
      { error: "tier must be 'PRO' or 'ENTERPRISE'" },
      { status: 400 }
    );
  }

  const priceId =
    tier === "PRO"
      ? process.env.STRIPE_PRICE_PRO
      : process.env.STRIPE_PRICE_ENTERPRISE;
  if (!priceId) {
    return NextResponse.json(
      { error: `STRIPE_PRICE_${tier} is not configured` },
      { status: 503 }
    );
  }

  const stripe = getStripe();

  // Reuse existing Stripe customer or create one. Tenant ↔ customer is 1:1.
  let billing = await prisma.billing.findUnique({
    where: { tenantId: session.tenantId },
  });

  if (!billing) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: session.tenantId },
    });
    const customer = await stripe.customers.create({
      email: session.email,
      name: tenant?.name ?? undefined,
      metadata: {
        tenantId: session.tenantId,
        engineId: String(session.engineId ?? ""),
      },
    });
    billing = await prisma.billing.create({
      data: {
        tenantId: session.tenantId,
        stripeCustomerId: customer.id,
        status: "incomplete",
      },
    });
  }

  const origin = request.nextUrl.origin;
  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: billing.stripeCustomerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/settings/billing?status=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/settings/billing?status=cancel`,
    client_reference_id: session.tenantId,
    metadata: {
      tenantId: session.tenantId,
      tier,
    },
    // Allow promo codes — surface upgrade incentives.
    allow_promotion_codes: true,
    // Tax collection is venue-jurisdiction-dependent. Leaving disabled
    // for now; counsel review per legal §5.
  });

  return NextResponse.json({ url: checkout.url });
}

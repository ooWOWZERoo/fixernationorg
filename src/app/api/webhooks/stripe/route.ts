import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import type Stripe from "stripe";

// Stage 0 proof — validates signature and dispatches to handlers.
// Actual business logic is wired in Phase 1 when Stripe keys are configured.
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET not configured" },
      { status: 500 }
    );
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Signature verification failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Idempotency: log the event ID; Phase 1 will deduplicate via DB
  console.log(`[stripe] event ${event.id} type=${event.type}`);

  switch (event.type) {
    case "checkout.session.completed":
      // Phase 1: activate membership / fulfill order
      break;
    case "invoice.payment_succeeded":
      // Phase 1: renew subscription
      break;
    case "invoice.payment_failed":
      // Phase 1: enter grace period
      break;
    case "customer.subscription.deleted":
      // Phase 1: cancel membership
      break;
    default:
      // Unknown event — return 200 so Stripe doesn't retry
      break;
  }

  return NextResponse.json({ received: true });
}

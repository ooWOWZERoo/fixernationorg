import Stripe from "stripe";

// Stub — `STRIPE_SECRET_KEY` is required at Phase 1, not Stage 0.
// This client will throw at call-time if the key is absent, not at import-time.
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "[stripe] STRIPE_SECRET_KEY is not configured. Required at Phase 1."
    );
  }
  return new Stripe(key, {
    apiVersion: "2025-02-24.acacia",
    typescript: true,
  });
}

// A stripeCustomerId saved under a different Stripe mode (e.g. a leftover
// test-mode ID after a live-mode key rotation) doesn't exist from the
// current API's point of view -- callers use this to self-heal by minting
// a fresh customer, rather than crashing on an uncaught Stripe error.
export function isMissingStripeCustomer(err: unknown): boolean {
  return err instanceof Stripe.errors.StripeError && err.code === "resource_missing" && (err as Stripe.errors.StripeInvalidRequestError).param === "customer";
}

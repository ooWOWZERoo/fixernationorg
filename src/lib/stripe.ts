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

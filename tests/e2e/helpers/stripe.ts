import Stripe from "stripe";

// Test-only Stripe access for cleaning up real objects the app creates
// against the LIVE Stripe account during e2e runs (e.g. the Coupon minted by
// POST /api/admin/affiliates/[id] action=promo -- see
// src/pages/api/admin/affiliates/[id].ts). The app itself never deletes
// these, so any spec that creates a promo code must delete the Stripe side
// of it here. Same env var and API version as src/lib/stripe.ts -- this is
// a separate client because test code runs in its own process, not the
// deployed app, and must not import server-only app modules.
let stripe: Stripe | null = null;

export function getTestStripe(): Stripe {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY not set — see .env.test");
    stripe = new Stripe(key, { apiVersion: "2025-02-24.acacia", typescript: true });
  }
  return stripe;
}

// Deletes a live Stripe Coupon created for a test promo code. Swallows
// "already deleted" / not-found errors so a re-run or a partial-failure
// retry can't itself fail the cleanup step.
export async function deleteStripeCoupon(couponId: string | null | undefined): Promise<void> {
  if (!couponId) return;
  try {
    await getTestStripe().coupons.del(couponId);
  } catch (err) {
    console.error(`[helpers/stripe] Failed to delete coupon ${couponId}:`, err);
  }
}

import { db } from "@/lib/db";

export interface ValidatedPromoCode {
  code: string;
  stripeCouponId: string;
  affiliateId: string;
}

export const PROMO_CODE_INVALID_MESSAGE = "This promo code is invalid or has expired.";

export function normalizePromoCode(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim().toUpperCase();
  return trimmed ? trimmed : null;
}

// A promo code either resolves to a usable Stripe coupon or the caller refuses
// the whole checkout — never send someone to Stripe without the discount they
// typed in. Product-type-agnostic on purpose: memberships and books share it.
export async function validatePromoCode(code: string): Promise<ValidatedPromoCode | null> {
  const found = await db.promoCode.findUnique({ where: { code } });
  const couponId = (found as unknown as { stripeCouponId: string | null } | null)?.stripeCouponId ?? null;
  const now = new Date();
  const usable =
    found &&
    couponId &&
    found.status === "ACTIVE" &&
    (!found.validUntil || found.validUntil > now) &&
    (found.maxUses === null || found.usedCount < found.maxUses);

  if (!usable) return null;
  return { code, stripeCouponId: couponId!, affiliateId: found!.affiliateId };
}

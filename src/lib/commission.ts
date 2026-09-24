import type Stripe from "stripe";
import { db } from "@/lib/db";

interface AttributeArgs {
  sub: Stripe.Subscription;
  inv: Stripe.Invoice;
  affiliateId: string;
  promoCode: string;
}

async function productTypeForSubscription(sub: Stripe.Subscription): Promise<string | null> {
  const priceId = sub.items.data[0]?.price?.metadata?.priceId;
  if (!priceId) return null;
  const price = await db.price.findUnique({
    where: { id: priceId },
    select: { product: { select: { type: true } } },
  });
  return price?.product.type ?? null;
}

// Most-specific-wins: a rule scoped to this product type beats the
// catch-all (appliesTo === null); ties break on the higher rate.
function pickRule<T extends { appliesTo: string | null; rate: unknown }>(
  rules: T[],
  productType: string | null
): T | null {
  const eligible = rules.filter((r) => r.appliesTo === null || r.appliesTo === productType);
  if (eligible.length === 0) return null;

  return eligible.reduce((best, candidate) => {
    const bestSpecific = best.appliesTo !== null;
    const candidateSpecific = candidate.appliesTo !== null;
    if (candidateSpecific !== bestSpecific) return candidateSpecific ? candidate : best;
    return Number(candidate.rate) > Number(best.rate) ? candidate : best;
  });
}

export async function attributeAffiliateCommission({
  sub,
  inv,
  affiliateId,
  promoCode,
}: AttributeArgs): Promise<void> {
  const productType = await productTypeForSubscription(sub);

  const rules = await db.commissionRule.findMany({
    where: { affiliateId, active: true },
  });
  const rule = pickRule(rules, productType);

  // The discount was genuinely redeemed even when no rule can price a
  // commission, so the redemption still counts against maxUses.
  if (!rule) {
    await db.promoCode.updateMany({
      where: { code: promoCode },
      data: { usedCount: { increment: 1 } },
    });
    return;
  }

  const grossAmount = (inv.amount_paid ?? 0) / 100;
  const rate = Number(rule.rate);
  const commissionAmount = rule.type === "PERCENTAGE" ? grossAmount * rate : rate;
  const pendingUntil =
    rule.pendingDays > 0 ? new Date(Date.now() + rule.pendingDays * 86400 * 1000) : null;

  await db.$transaction(async (tx) => {
    await tx.commissionLedger.create({
      data: {
        affiliateId,
        sourceType: "PROMO_CODE",
        sourceRef: sub.id,
        description: `Promo code ${promoCode} — first charge`,
        grossAmount,
        commissionRate: rule.type === "PERCENTAGE" ? rate : null,
        commissionAmount,
        pendingUntil,
        status: pendingUntil ? "PENDING" : "APPROVED",
        ...(pendingUntil ? {} : { approvedAt: new Date() }),
      },
    });
    await tx.promoCode.updateMany({
      where: { code: promoCode },
      data: { usedCount: { increment: 1 } },
    });
  });
}

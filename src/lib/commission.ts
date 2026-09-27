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

interface BookOrderAttributeArgs {
  bookOrderId: string;
  affiliateId: string;
  promoCode: string;
  /** Cents, straight off the Checkout Session's amount_total. */
  grossAmountCents: number | null;
}

// BookOrder is a model the local Prisma client doesn't know about yet
// (regenerates on the next Vercel build) — cast at the call site per
// project convention.
type BookOrderCommissionDb = {
  bookOrder: {
    findUnique: (a: unknown) => Promise<{ product: { type: string } } | null>;
  };
};

// Parallel to attributeAffiliateCommission, but for a one-time book purchase:
// no subscription, no invoice, and the ledger row keys off the BookOrder id.
export async function attributeAffiliateCommissionForBookOrder({
  bookOrderId,
  affiliateId,
  promoCode,
  grossAmountCents,
}: BookOrderAttributeArgs): Promise<void> {
  // checkout.session.completed fires once per session under normal delivery,
  // so this only matters when a retry follows a failure on our side.
  const already = await db.commissionLedger.findFirst({
    where: { sourceType: "PROMO_CODE", sourceRef: bookOrderId },
    select: { id: true },
  });
  if (already) return;

  const bookOrderDb = db as never as BookOrderCommissionDb;
  const order = await bookOrderDb.bookOrder.findUnique({
    where: { id: bookOrderId },
    select: { product: { select: { type: true } } },
  });
  const productType = order?.product.type ?? null;

  // Book sales never fall back to an affiliate's catch-all (membership) rate:
  // only an explicitly BOOK-scoped rule can price one. Pre-filtering here
  // leaves pickRule's catch-all matching untouched for the subscription path.
  const allRules = await db.commissionRule.findMany({
    where: { affiliateId, active: true },
  });
  const rule = pickRule(
    allRules.filter((r) => r.appliesTo === "BOOK"),
    productType
  );

  const grossAmount = (grossAmountCents ?? 0) / 100;

  // Same reasoning as the subscription path: the discount was genuinely
  // redeemed even when no rule can price a commission, so the redemption
  // still counts against maxUses, and the zero-amount CANCELLED row is the
  // marker that stops a retry from incrementing usedCount twice.
  if (!rule) {
    await db.$transaction(async (tx) => {
      await tx.commissionLedger.create({
        data: {
          affiliateId,
          sourceType: "PROMO_CODE",
          sourceRef: bookOrderId,
          description: `Promo code ${promoCode} redeemed on a book purchase — no active BOOK commission rule matched`,
          grossAmount,
          commissionRate: null,
          commissionAmount: 0,
          status: "CANCELLED",
        },
      });
      await tx.promoCode.updateMany({
        where: { code: promoCode },
        data: { usedCount: { increment: 1 } },
      });
    });
    return;
  }

  const rate = Number(rule.rate);
  const commissionAmount = rule.type === "PERCENTAGE" ? grossAmount * rate : rate;
  const pendingUntil =
    rule.pendingDays > 0 ? new Date(Date.now() + rule.pendingDays * 86400 * 1000) : null;

  await db.$transaction(async (tx) => {
    await tx.commissionLedger.create({
      data: {
        affiliateId,
        sourceType: "PROMO_CODE",
        sourceRef: bookOrderId,
        description: `Promo code ${promoCode} — book purchase`,
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

  const grossAmount = (inv.amount_paid ?? 0) / 100;

  // The discount was genuinely redeemed even when no rule can price a
  // commission, so the redemption still counts against maxUses. The
  // zero-amount CANCELLED row is what makes that increment happen exactly
  // once: the webhook decides "attribution already ran" by looking for a
  // PROMO_CODE ledger row on this subscription, so without a marker row
  // every later renewal would re-run attribution and inflate usedCount.
  if (!rule) {
    await db.$transaction(async (tx) => {
      await tx.commissionLedger.create({
        data: {
          affiliateId,
          sourceType: "PROMO_CODE",
          sourceRef: sub.id,
          description: `Promo code ${promoCode} redeemed — no active commission rule matched at time of first charge`,
          grossAmount,
          commissionRate: null,
          commissionAmount: 0,
          status: "CANCELLED",
        },
      });
      await tx.promoCode.updateMany({
        where: { code: promoCode },
        data: { usedCount: { increment: 1 } },
      });
    });
    return;
  }

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

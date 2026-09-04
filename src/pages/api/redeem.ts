import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  code: z.string().min(1).max(40).transform((s) => s.trim().toUpperCase()),
});

// GiftCode.membershipDurationDays is a new column the local Prisma client
// doesn't know about yet (regenerates on the next Vercel build) — cast at
// the call site per project convention.
type GiftCodeDurationRow = { membershipDurationDays: number | null };

// Same story for UserMembership.source, added alongside membershipDurationDays.
type GiftMembershipTxDb = {
  userMembership: {
    upsert: (a: unknown) => Promise<unknown>;
  };
};

const GIFT_MEMBERSHIP_PRODUCT_SLUG = "free-90-day-book-gift";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Sign in to redeem a code" });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid code format" });

  const { code } = parsed.data;

  const giftCode = await db.giftCode.findUnique({ where: { code } });

  if (!giftCode) return res.status(404).json({ error: "That code doesn't exist." });
  if (giftCode.redeemedAt) return res.status(409).json({ error: "That code has already been redeemed." });
  if (giftCode.expiresAt && giftCode.expiresAt < new Date()) {
    return res.status(410).json({ error: "That code has expired." });
  }

  const redeemedAt = new Date();
  const membershipDurationDays = (giftCode as unknown as GiftCodeDurationRow).membershipDurationDays;

  // Time-bound gift membership (e.g. the free 90-day book promo) — mirror it
  // into a real UserMembership row so it participates in the same
  // renewal/expiry/reminder system as paid Stripe subscriptions.
  if (membershipDurationDays) {
    const giftPrice = await db.price.findFirst({
      where: { product: { slug: GIFT_MEMBERSHIP_PRODUCT_SLUG } },
      select: { id: true, membershipRole: true },
    });

    if (!giftPrice) {
      return res.status(500).json({ error: "Gift membership plan is not configured. Contact support." });
    }

    const grantedRole = giftPrice.membershipRole ?? giftCode.grantedRole;
    const currentPeriodEnd = new Date(redeemedAt.getTime() + membershipDurationDays * 24 * 60 * 60 * 1000);

    await db.$transaction(async (tx) => {
      await tx.giftCode.update({
        where: { id: giftCode.id },
        data: { redeemedByUserId: session.user.id, redeemedAt },
      });
      await tx.user.update({
        where: { id: session.user.id },
        data: { role: grantedRole },
      });

      const membershipTx = tx as never as GiftMembershipTxDb;
      await membershipTx.userMembership.upsert({
        where: { userId: session.user.id },
        create: {
          userId: session.user.id,
          priceId: giftPrice.id,
          source: "GIFT_CODE",
          status: "ACTIVE",
          currentPeriodEnd,
        },
        update: {
          priceId: giftPrice.id,
          source: "GIFT_CODE",
          status: "ACTIVE",
          currentPeriodEnd,
          stripeSubscriptionId: null,
          cancelAtPeriodEnd: false,
          trialEnd: null,
          updatedAt: new Date(),
        },
      });
    });

    return res.json({ grantedRole });
  }

  // Existing behavior, unchanged: permanent ad-hoc role grant, no membership tracking.
  await db.$transaction([
    db.giftCode.update({
      where: { id: giftCode.id },
      data: { redeemedByUserId: session.user.id, redeemedAt },
    }),
    db.user.update({
      where: { id: session.user.id },
      data: { role: giftCode.grantedRole },
    }),
  ]);

  return res.json({ grantedRole: giftCode.grantedRole });
}

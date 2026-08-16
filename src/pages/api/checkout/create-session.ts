import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

const bodySchema = z.object({
  priceId: z.string().min(1),
});

type MembershipDb = {
  userMembership: {
    findUnique: (a: unknown) => Promise<{ stripeSubscriptionId: string | null } | null>;
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: "Sign in to continue" });
  }

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "priceId is required" });
  }

  const price = await db.price.findUnique({
    where: { id: parsed.data.priceId, active: true },
    select: {
      id: true,
      interval: true,
      amount: true,
      trialDays: true,
      membershipRole: true,
      stripePriceId: true,
      product: { select: { name: true, stripeProductId: true } },
    },
  });

  if (!price) {
    return res.status(404).json({ error: "Price not found" });
  }

  if (!price.stripePriceId) {
    return res.status(400).json({ error: "This plan is not yet available for purchase. Please contact support." });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, stripeCustomerId: true },
  });
  if (!user) return res.status(404).json({ error: "User not found" });

  // Check if user already has an active subscription
  const membershipDb = db as never as MembershipDb;
  const existing = await membershipDb.userMembership.findUnique({
    where: { userId: user.id } as unknown as Record<string, unknown>,
  });
  if (existing?.stripeSubscriptionId) {
    return res.status(409).json({ error: "You already have an active membership. Manage it from your billing page." });
  }

  const stripe = getStripe();
  const baseUrl = process.env.NEXTAUTH_URL ?? "https://fixernation.org";

  // Create or reuse Stripe Customer
  let stripeCustomerId = user.stripeCustomerId;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { userId: user.id },
    });
    stripeCustomerId = customer.id;
    await db.user.update({
      where: { id: user.id },
      data: { stripeCustomerId },
    });
  }

  const isSubscription = price.interval === "MONTHLY" || price.interval === "ANNUAL";

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: isSubscription ? "subscription" : "payment",
    payment_method_types: ["card"],
    line_items: [{ price: price.stripePriceId, quantity: 1 }],
    ...(isSubscription && price.trialDays
      ? { subscription_data: { trial_period_days: price.trialDays, metadata: { userId: user.id, priceId: price.id } } }
      : isSubscription
      ? { subscription_data: { metadata: { userId: user.id, priceId: price.id } } }
      : {}),
    metadata: { userId: user.id, priceId: price.id },
    success_url: `${baseUrl}/account/billing?checkout=success`,
    cancel_url: `${baseUrl}/join`,
  });

  return res.status(200).json({ url: checkoutSession.url });
}

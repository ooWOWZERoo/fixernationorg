import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

// Interval mapping: Prisma PriceInterval → Stripe recurring interval
const STRIPE_INTERVAL: Record<string, { interval: "month" | "year" } | null> = {
  MONTHLY: { interval: "month" },
  ANNUAL: { interval: "year" },
  ONE_TIME: null,
  FREE_TRIAL: null,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { id } = req.query as { id: string };

  const product = await db.product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      active: true,
      stripeProductId: true,
      prices: {
        where: { active: true },
        select: { id: true, interval: true, amount: true, currency: true, stripePriceId: true },
      },
    },
  });

  if (!product) return res.status(404).json({ error: "Product not found" });

  const stripe = getStripe();

  // Create or update the Stripe Product
  let stripeProductId = product.stripeProductId;
  if (stripeProductId) {
    await stripe.products.update(stripeProductId, {
      name: product.name,
      description: product.description ?? undefined,
      active: product.active,
    });
  } else {
    const sp = await stripe.products.create({
      name: product.name,
      description: product.description ?? undefined,
      active: product.active,
      metadata: { productId: product.id },
    });
    stripeProductId = sp.id;
    await db.product.update({ where: { id }, data: { stripeProductId } });
  }

  // Sync each active price
  const syncedPrices: { priceId: string; stripePriceId: string }[] = [];

  for (const price of product.prices) {
    // Stripe Prices are immutable — only create, never update
    if (price.stripePriceId) {
      syncedPrices.push({ priceId: price.id, stripePriceId: price.stripePriceId });
      continue;
    }

    const recurring = STRIPE_INTERVAL[price.interval];

    const sp = await stripe.prices.create({
      product: stripeProductId,
      unit_amount: price.amount,
      currency: price.currency,
      ...(recurring ? { recurring } : {}),
      metadata: { priceId: price.id },
    });

    await db.price.update({ where: { id: price.id }, data: { stripePriceId: sp.id } });
    syncedPrices.push({ priceId: price.id, stripePriceId: sp.id });
  }

  return res.status(200).json({ stripeProductId, syncedPrices });
}

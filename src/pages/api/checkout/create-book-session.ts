import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripe, isMissingStripeCustomer } from "@/lib/stripe";
import Stripe from "stripe";

const bodySchema = z.object({
  priceId: z.string().min(1),
});

// BookOrder is a new model the local Prisma client doesn't know about yet
// (regenerates on the next Vercel build) — cast at the call site per
// project convention.
type BookOrderDb = {
  bookOrder: {
    create: (a: unknown) => Promise<{ id: string }>;
    update: (a: unknown) => Promise<unknown>;
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
      stripePriceId: true,
      productId: true,
      product: { select: { slug: true, type: true } },
    },
  });

  if (!price) {
    return res.status(404).json({ error: "Price not found" });
  }

  if (price.product.type !== "BOOK") {
    return res.status(400).json({ error: "This price is not for a book." });
  }

  if (price.interval !== "ONE_TIME" || !price.stripePriceId) {
    return res.status(400).json({ error: "This book is not yet available for purchase. Please contact support." });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, stripeCustomerId: true },
  });
  if (!user) return res.status(404).json({ error: "User not found" });

  const stripe = getStripe();
  const baseUrl = process.env.NEXTAUTH_URL ?? "https://fixernation.org";
  const bookOrderDb = db as never as BookOrderDb;
  const nnUser = user;
  const nnPrice = price;

  async function createFreshCustomer(): Promise<string> {
    const customer = await stripe.customers.create({
      email: nnUser.email ?? undefined,
      metadata: { userId: nnUser.id },
    });
    await db.user.update({ where: { id: nnUser.id }, data: { stripeCustomerId: customer.id } });
    return customer.id;
  }

  try {
    // Create or reuse Stripe Customer — no membership-subscription check here:
    // buying a book must work regardless of any existing UserMembership.
    let stripeCustomerId = nnUser.stripeCustomerId ?? (await createFreshCustomer());

    // Create the BookOrder row PENDING before creating the Checkout Session
    // (stripeCheckoutSessionId is unique+required, so seed it with a
    // placeholder, then swap in the real session id right after) — mirrors
    // how OnboardingRecord links to applicationId.
    const bookOrder = await bookOrderDb.bookOrder.create({
      data: {
        userId: nnUser.id,
        productId: nnPrice.productId,
        priceId: nnPrice.id,
        status: "PENDING",
        stripeCheckoutSessionId: `pending_${nnUser.id}_${Date.now()}`,
      },
    });

    function buildSessionParams(customerId: string): Stripe.Checkout.SessionCreateParams {
      return {
        customer: customerId,
        mode: "payment",
        payment_method_types: ["card"],
        shipping_address_collection: { allowed_countries: ["US", "CA"] },
        line_items: [{ price: nnPrice.stripePriceId!, quantity: 1 }],
        metadata: { userId: nnUser.id, bookOrderId: bookOrder.id },
        success_url: `${baseUrl}/account/book-orders/${bookOrder.id}?checkout=success`,
        cancel_url: `${baseUrl}/books/${nnPrice.product.slug}`,
      };
    }

    let checkoutSession: Stripe.Checkout.Session;
    try {
      checkoutSession = await stripe.checkout.sessions.create(buildSessionParams(stripeCustomerId));
    } catch (err) {
      if (!isMissingStripeCustomer(err)) throw err;
      stripeCustomerId = await createFreshCustomer();
      checkoutSession = await stripe.checkout.sessions.create(buildSessionParams(stripeCustomerId));
    }

    await bookOrderDb.bookOrder.update({
      where: { id: bookOrder.id },
      data: { stripeCheckoutSessionId: checkoutSession.id },
    });

    return res.status(200).json({ url: checkoutSession.url });
  } catch (err) {
    console.error("[checkout/create-book-session] Stripe error:", err);
    return res.status(500).json({ error: "Something went wrong starting checkout. Please try again or contact support." });
  }
}

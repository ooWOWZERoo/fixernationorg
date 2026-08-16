import type { NextApiRequest, NextApiResponse } from "next";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { db } from "@/lib/db";

export const config = {
  api: {
    bodyParser: false,
  },
};

function getRawBody(req: NextApiRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

type MembershipDb = {
  userMembership: {
    upsert: (a: unknown) => Promise<unknown>;
    updateMany: (a: unknown) => Promise<unknown>;
    findFirst: (a: unknown) => Promise<{ userId: string; priceId: string } | null>;
  };
};

// Look up userId from Stripe customerId
async function userIdFromCustomer(customerId: string): Promise<string | null> {
  const user = await db.user.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  return user?.id ?? null;
}

async function handleSubscriptionUpsert(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const userId = await userIdFromCustomer(customerId);
  if (!userId) return;

  const priceId = sub.items.data[0]?.price?.metadata?.priceId;
  const membershipDb = db as never as MembershipDb;

  // Map Stripe status to our SubscriptionStatus enum
  const statusMap: Record<string, string> = {
    trialing: "TRIALING",
    active: "ACTIVE",
    past_due: "PAST_DUE",
    canceled: "CANCELED",
    incomplete: "INCOMPLETE",
    incomplete_expired: "CANCELED",
    unpaid: "PAST_DUE",
    paused: "PAST_DUE",
  };
  const status = statusMap[sub.status] ?? "ACTIVE";
  const currentPeriodEnd = new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000);
  const trialEnd = (sub as unknown as { trial_end: number | null }).trial_end
    ? new Date((sub as unknown as { trial_end: number }).trial_end * 1000)
    : null;

  if (!priceId) {
    // Fall back to matching via existing membership row
    const existing = await membershipDb.userMembership.findFirst({
      where: { userId } as unknown as Record<string, unknown>,
    });
    if (!existing) return;
    await membershipDb.userMembership.updateMany({
      where: { userId } as unknown as Record<string, unknown>,
      data: { status, currentPeriodEnd, cancelAtPeriodEnd: sub.cancel_at_period_end, trialEnd, updatedAt: new Date() } as unknown as Record<string, unknown>,
    });
    return;
  }

  await membershipDb.userMembership.upsert({
    where: { userId } as unknown as Record<string, unknown>,
    create: {
      userId,
      priceId,
      stripeSubscriptionId: sub.id,
      stripeCustomerId: customerId,
      status,
      currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      trialEnd,
    } as unknown as Record<string, unknown>,
    update: {
      stripeSubscriptionId: sub.id,
      stripeCustomerId: customerId,
      status,
      currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      trialEnd,
      updatedAt: new Date(),
    } as unknown as Record<string, unknown>,
  });

  // Grant role if active or trialing
  if (status === "ACTIVE" || status === "TRIALING") {
    const price = await db.price.findUnique({ where: { id: priceId }, select: { membershipRole: true } });
    if (price?.membershipRole) {
      await db.user.update({ where: { id: userId }, data: { role: price.membershipRole } });
    }
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const stripe = getStripe();
  const body = await getRawBody(req);
  const sig = req.headers["stripe-signature"];

  if (!sig) {
    return res.status(400).json({ error: "Missing stripe-signature" });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return res.status(500).json({ error: "STRIPE_WEBHOOK_SECRET not configured" });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Signature verification failed";
    return res.status(400).json({ error: message });
  }


  switch (event.type) {
    // ── Onboarding / SP+BA payment ────────────────────────────────────────────
    case "checkout.session.completed": {
      const cs = event.data.object as Stripe.Checkout.Session;
      const applicationId = cs.metadata?.applicationId;

      if (applicationId) {
        // SP/BA onboarding fee
        await db.onboardingRecord.updateMany({
          where: { OR: [{ stripeCheckoutSessionId: cs.id }, { applicationId }] },
          data: {
            paymentStatus: "COMPLETED",
            paidAt: new Date(),
            stripePaymentIntentId:
              typeof cs.payment_intent === "string" ? cs.payment_intent : null,
          },
        });
        await db.applicationEvent.create({
          data: {
            applicationId,
            type: "PAYMENT_RECEIVED",
            actor: "stripe",
            meta: { sessionId: cs.id, amountTotal: cs.amount_total, currency: cs.currency },
          },
        });
      }
      // Subscription sessions are handled via customer.subscription.* events below
      break;
    }

    case "checkout.session.expired": {
      const cs = event.data.object as Stripe.Checkout.Session;
      const applicationId = cs.metadata?.applicationId;
      if (!applicationId) break;

      await db.onboardingRecord.updateMany({
        where: { stripeCheckoutSessionId: cs.id },
        data: { stripePaymentLinkUrl: null, stripeCheckoutSessionId: null },
      });
      await db.applicationEvent.create({
        data: {
          applicationId,
          type: "PAYMENT_LINK_EXPIRED",
          actor: "stripe",
          meta: { sessionId: cs.id },
        },
      });
      break;
    }

    // ── Membership subscriptions ───────────────────────────────────────────────
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await handleSubscriptionUpsert(event.data.object as Stripe.Subscription);
      break;

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const userId = await userIdFromCustomer(customerId);
      if (!userId) break;

      const membershipDb = db as never as MembershipDb;
      await membershipDb.userMembership.updateMany({
        where: { userId } as unknown as Record<string, unknown>,
        data: { status: "CANCELED", cancelAtPeriodEnd: false, updatedAt: new Date() } as unknown as Record<string, unknown>,
      });
      // Downgrade to CONSUMER
      await db.user.update({ where: { id: userId }, data: { role: "CONSUMER" } });
      break;
    }

    case "invoice.payment_succeeded": {
      const inv = event.data.object as Stripe.Invoice;
      const subId = typeof (inv as unknown as { subscription: unknown }).subscription === "string"
        ? (inv as unknown as { subscription: string }).subscription
        : null;
      if (!subId) break;
      // Refresh subscription state on successful renewal
      const sub = await stripe.subscriptions.retrieve(subId);
      await handleSubscriptionUpsert(sub);
      break;
    }

    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice;
      const customerId = typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
      if (!customerId) break;
      const userId = await userIdFromCustomer(customerId);
      if (!userId) break;

      const membershipDb = db as never as MembershipDb;
      await membershipDb.userMembership.updateMany({
        where: { userId } as unknown as Record<string, unknown>,
        data: { status: "PAST_DUE", updatedAt: new Date() } as unknown as Record<string, unknown>,
      });
      break;
    }

    default:
      break;
  }

  return res.status(200).json({ received: true });
}

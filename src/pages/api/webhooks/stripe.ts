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

  console.log(`[stripe] event ${event.id} type=${event.type}`);

  switch (event.type) {
    case "checkout.session.completed": {
      const cs = event.data.object as Stripe.Checkout.Session;
      const applicationId = cs.metadata?.applicationId;
      if (!applicationId) break;

      await db.onboardingRecord.updateMany({
        where: {
          OR: [
            { stripeCheckoutSessionId: cs.id },
            { applicationId },
          ],
        },
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
          meta: {
            sessionId: cs.id,
            amountTotal: cs.amount_total,
            currency: cs.currency,
          },
        },
      });
      break;
    }

    case "checkout.session.expired": {
      const cs = event.data.object as Stripe.Checkout.Session;
      const applicationId = cs.metadata?.applicationId;
      if (!applicationId) break;

      await db.onboardingRecord.updateMany({
        where: { stripeCheckoutSessionId: cs.id },
        data: {
          stripePaymentLinkUrl: null,
          stripeCheckoutSessionId: null,
        },
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

    case "invoice.payment_succeeded":
      // Reserved for subscription renewals (future)
      break;

    case "invoice.payment_failed":
      // Reserved for subscription grace period (future)
      break;

    case "customer.subscription.deleted":
      // Reserved for membership cancellation (future)
      break;

    default:
      break;
  }

  return res.status(200).json({ received: true });
}

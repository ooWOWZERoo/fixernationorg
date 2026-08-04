import type { NextApiRequest, NextApiResponse } from "next";
import { getStripe } from "@/lib/stripe";
import type Stripe from "stripe";

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
    case "checkout.session.completed":
      // Phase 1: activate membership / fulfill order
      break;
    case "invoice.payment_succeeded":
      // Phase 1: renew subscription
      break;
    case "invoice.payment_failed":
      // Phase 1: enter grace period
      break;
    case "customer.subscription.deleted":
      // Phase 1: cancel membership
      break;
    default:
      break;
  }

  return res.status(200).json({ received: true });
}

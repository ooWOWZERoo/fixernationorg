import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { handleSubscriptionUpsert } from "@/pages/api/webhooks/stripe";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

// Manually reconciles a user's UserMembership against their actual current
// Stripe subscription state — for cases where the webhook never
// successfully processed the original event (Stripe does not retry an
// event that already received a 200, even if the handler failed
// internally after responding).
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const email = req.body?.email as string;
  if (!email) return res.status(400).json({ error: "email required" });

  const user = await db.user.findUnique({ where: { email }, select: { id: true, stripeCustomerId: true } });
  if (!user) return res.status(404).json({ error: "no user with that email" });
  if (!user.stripeCustomerId) return res.status(400).json({ error: "user has no stripeCustomerId" });

  const stripe = getStripe();
  const subs = await stripe.subscriptions.list({ customer: user.stripeCustomerId, status: "all", limit: 5 });
  if (subs.data.length === 0) {
    return res.status(404).json({ error: "no Stripe subscriptions found for this customer" });
  }

  // Most recent by creation.
  const sub = subs.data.sort((a, b) => b.created - a.created)[0];
  await handleSubscriptionUpsert(sub);

  return res.status(200).json({ resyncedSubscriptionId: sub.id, status: sub.status, totalSubscriptionsFound: subs.data.length });
}

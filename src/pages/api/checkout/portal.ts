import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripe, isMissingStripeCustomer } from "@/lib/stripe";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: "Sign in to continue" });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { stripeCustomerId: true },
  });

  if (!user?.stripeCustomerId) {
    return res.status(400).json({ error: "No billing account found." });
  }

  const stripe = getStripe();
  const baseUrl = process.env.NEXTAUTH_URL ?? "https://fixernation.org";

  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${baseUrl}/account/billing`,
    });
    return res.status(200).json({ url: portalSession.url });
  } catch (err) {
    // A customer ID saved under a different Stripe mode (e.g. a leftover
    // test-mode ID after a live-mode key rotation) doesn't exist from the
    // live API's point of view -- there's no portal to open for it, so this
    // is functionally the same as "no billing account found," not a 500.
    if (isMissingStripeCustomer(err)) {
      return res.status(400).json({ error: "No billing account found." });
    }
    console.error("[checkout/portal] Stripe error:", err);
    return res.status(500).json({ error: "Something went wrong opening billing. Please try again or contact support." });
  }
}

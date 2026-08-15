import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { recordEvent } from "@/lib/application-events";
import { logAction } from "@/lib/audit";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

// Statuses where it makes sense to move to PAYMENT_PENDING automatically
const PRE_PAYMENT_STATUSES = [
  "ACCEPTED_ONBOARDING_REQUIRED",
  "ONBOARDING_IN_PROGRESS",
  "TERRITORY_PENDING",
  "PAYMENT_FAILED",
];

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

  const application = await db.userApplication.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, type: true, status: true },
  });
  if (!application) return res.status(404).json({ error: "Application not found" });

  const onboarding = await db.onboardingRecord.findUnique({ where: { applicationId: id } });
  if (!onboarding) {
    return res.status(400).json({ error: "Set pricing terms before generating a payment link." });
  }

  const amountDollars = Number(onboarding.finalAmount ?? onboarding.quotedAmount);
  if (!amountDollars || isNaN(amountDollars) || amountDollars <= 0) {
    return res.status(400).json({ error: "Set a positive final amount before generating a payment link." });
  }

  const stripe = getStripe();
  const amountCents = Math.round(amountDollars * 100);
  const appType = application.type === "PROVIDER" ? "Service Provider" : "Brand Ambassador";
  const baseUrl = process.env.NEXTAUTH_URL ?? "";

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: application.email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: {
            name: `Fixer Nation ${appType} Onboarding Fee`,
            description: `Onboarding for ${application.name ?? application.email}`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      applicationId: application.id,
      onboardingRecordId: onboarding.id,
    },
    success_url: `${baseUrl}/admin/applications/${application.id}?payment=success`,
    cancel_url: `${baseUrl}/admin/applications/${application.id}?payment=cancelled`,
    // 7-day expiry (Stripe max is 24h for basic sessions; use Payment Links for longer validity)
    expires_at: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
  });

  await db.onboardingRecord.update({
    where: { applicationId: id },
    data: {
      stripeCheckoutSessionId: checkoutSession.id,
      stripePaymentLinkUrl: checkoutSession.url,
      // Reset FAILED back to PENDING when regenerating
      paymentStatus: onboarding.paymentStatus === "FAILED" ? "PENDING" : onboarding.paymentStatus,
    },
  });

  // Move to PAYMENT_PENDING if still in an earlier onboarding status
  if (PRE_PAYMENT_STATUSES.includes(application.status)) {
    await db.userApplication.update({
      where: { id },
      data: { status: "PAYMENT_PENDING" },
    });
  }

  recordEvent(id, "PAYMENT_LINK_SENT", session.user.email, {
    sessionId: checkoutSession.id,
    amount: amountDollars,
    currency: "usd",
  }).catch(console.error);

  logAction({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "application.payment_link_generated",
    resource: "OnboardingRecord",
    resourceId: onboarding.id,
    metadata: { applicationId: id, sessionId: checkoutSession.id, amount: amountDollars },
  }).catch(console.error);

  return res.status(200).json({ url: checkoutSession.url, sessionId: checkoutSession.id });
}

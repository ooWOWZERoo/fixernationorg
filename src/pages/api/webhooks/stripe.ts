import type { NextApiRequest, NextApiResponse } from "next";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { loadTemplate } from "@/lib/template-engine";
import {
  buildMembershipThankYouEmail,
  buildRenewalReceiptEmail,
  buildPaymentFailedEmail,
  buildMembershipCanceledEmail,
} from "@/lib/emails/membership";

const BASE_URL = process.env.NEXTAUTH_URL ?? "https://fixernation.org";

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
    findFirst: (
      a: unknown
    ) => Promise<{ userId: string; priceId: string; currentPeriodEnd: Date | null } | null>;
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

function formatRenewalDate(d: Date): string {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

async function getPlanNameForPriceId(priceId: string | null | undefined): Promise<string> {
  if (!priceId) return "Fixer Nation";
  const price = await db.price.findUnique({ where: { id: priceId }, include: { product: true } });
  return price?.product.name ?? "Fixer Nation";
}

// Looks up the user's email/name plus their current plan name (via the
// UserMembership → Price → Product chain) for events that only carry a userId.
async function getUserAndPlan(
  userId: string
): Promise<{ email: string; name: string | null; planName: string } | null> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
  if (!user?.email) return null;
  const membershipDb = db as never as MembershipDb;
  const membership = await membershipDb.userMembership.findFirst({
    where: { userId } as unknown as Record<string, unknown>,
  });
  const planName = await getPlanNameForPriceId(membership?.priceId);
  return { email: user.email, name: user.name, planName };
}

async function sendMembershipThankYouEmail(userId: string, priceId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
  if (!user?.email) return;
  const planName = await getPlanNameForPriceId(priceId);
  const firstName = (user.name ?? "").split(" ")[0] || "there";
  const billingUrl = `${BASE_URL}/account/billing`;

  const email =
    (await loadTemplate("membership.purchase_thankyou", {
      first_name: firstName,
      plan_name: planName,
      billing_url: billingUrl,
    })) ?? buildMembershipThankYouEmail(user.name, planName, billingUrl);

  await sendEmail({ to: user.email, ...email });
}

async function handleSubscriptionUpsert(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const userId = await userIdFromCustomer(customerId);
  console.error("[stripe-webhook-diag]", JSON.stringify({
    subId: sub.id, subStatus: sub.status, customerId, userId,
    rawPrice: sub.items.data[0]?.price,
  }));
  if (!userId) return;

  const priceId = sub.items.data[0]?.price?.metadata?.priceId;
  console.error("[stripe-webhook-diag] resolved priceId:", priceId);
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
      data: { source: "STRIPE", status, currentPeriodEnd, cancelAtPeriodEnd: sub.cancel_at_period_end, trialEnd, updatedAt: new Date() } as unknown as Record<string, unknown>,
    });
    return;
  }

  // Determine ahead of time whether this upsert will create a brand-new
  // membership row — that's the only case where the purchase thank-you
  // email should fire, regardless of which Stripe event triggered this call.
  const existingMembership = await membershipDb.userMembership.findFirst({
    where: { userId } as unknown as Record<string, unknown>,
  });
  const isNewMembership = !existingMembership;

  // A new billing period means the 30/7-day renewal reminders need to be
  // able to fire again for this cycle — otherwise, once sent, they'd stay
  // permanently non-null and the reminder job would never fire after the
  // first renewal.
  const periodChanged =
    !!existingMembership &&
    existingMembership.currentPeriodEnd?.getTime() !== currentPeriodEnd.getTime();

  await membershipDb.userMembership.upsert({
    where: { userId } as unknown as Record<string, unknown>,
    create: {
      userId,
      priceId,
      source: "STRIPE",
      stripeSubscriptionId: sub.id,
      stripeCustomerId: customerId,
      status,
      currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      trialEnd,
    } as unknown as Record<string, unknown>,
    update: {
      // A real Stripe subscription always supersedes whatever was there
      // before (e.g. a free gift membership) — without this, upserting
      // over an existing GIFT_CODE row would leave source untouched, since
      // Prisma's update only writes fields you actually specify.
      priceId,
      source: "STRIPE",
      stripeSubscriptionId: sub.id,
      stripeCustomerId: customerId,
      status,
      currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      trialEnd,
      updatedAt: new Date(),
      ...(periodChanged ? { renewal30ReminderSentAt: null, renewal7ReminderSentAt: null } : {}),
    } as unknown as Record<string, unknown>,
  });

  // Grant role if active or trialing
  if (status === "ACTIVE" || status === "TRIALING") {
    const price = await db.price.findUnique({ where: { id: priceId }, select: { membershipRole: true } });
    if (price?.membershipRole) {
      await db.user.update({ where: { id: userId }, data: { role: price.membershipRole } });
    }
  }

  if (isNewMembership) {
    try {
      await sendMembershipThankYouEmail(userId, priceId);
    } catch (err) {
      console.error("[stripe-webhook] purchase thank-you email failed:", err);
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

      try {
        const info = await getUserAndPlan(userId);
        if (info) {
          const firstName = (info.name ?? "").split(" ")[0] || "there";
          const upgradeUrl = `${BASE_URL}/join`;
          const email =
            (await loadTemplate("membership.canceled", {
              first_name: firstName,
              plan_name: info.planName,
              upgrade_url: upgradeUrl,
            })) ?? buildMembershipCanceledEmail(info.name, info.planName, upgradeUrl);
          await sendEmail({ to: info.email, ...email });
        }
      } catch (err) {
        console.error("[stripe-webhook] cancellation email failed:", err);
      }
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

      // Only a true renewal cycle gets a receipt email — the first invoice
      // on a new subscription (billing_reason "subscription_create") is
      // already covered by the purchase thank-you email above.
      if (inv.billing_reason === "subscription_cycle") {
        try {
          const customerId = typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
          const userId = customerId ? await userIdFromCustomer(customerId) : null;
          if (userId) {
            const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
            if (user?.email) {
              const priceId = sub.items.data[0]?.price?.metadata?.priceId;
              const planName = await getPlanNameForPriceId(priceId);
              const firstName = (user.name ?? "").split(" ")[0] || "there";
              const periodEnd = new Date(
                (sub as unknown as { current_period_end: number }).current_period_end * 1000
              );
              const amount = formatCents(inv.amount_paid ?? 0);
              const renewalDate = formatRenewalDate(periodEnd);
              const billingUrl = `${BASE_URL}/account/billing`;
              const email =
                (await loadTemplate("membership.renewal_receipt", {
                  first_name: firstName,
                  plan_name: planName,
                  amount,
                  renewal_date: renewalDate,
                  billing_url: billingUrl,
                })) ?? buildRenewalReceiptEmail(user.name, planName, amount, renewalDate, billingUrl);
              await sendEmail({ to: user.email, ...email });
            }
          }
        } catch (err) {
          console.error("[stripe-webhook] renewal receipt email failed:", err);
        }
      }
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

      try {
        const info = await getUserAndPlan(userId);
        if (info) {
          const firstName = (info.name ?? "").split(" ")[0] || "there";
          const billingUrl = `${BASE_URL}/account/billing`;
          const email =
            (await loadTemplate("membership.payment_failed", {
              first_name: firstName,
              plan_name: info.planName,
              billing_url: billingUrl,
            })) ?? buildPaymentFailedEmail(info.name, info.planName, billingUrl);
          await sendEmail({ to: info.email, ...email });
        }
      } catch (err) {
        console.error("[stripe-webhook] payment-failed email failed:", err);
      }
      break;
    }

    default:
      break;
  }

  return res.status(200).json({ received: true });
}

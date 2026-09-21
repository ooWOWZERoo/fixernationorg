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
import { enrollInJourneys } from "@/lib/automation";
import { ensureContactForUser, ensureDefaultMorningBoostConsent } from "@/lib/contacts";

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

// BookOrder is a new model the local Prisma client doesn't know about yet
// (regenerates on the next Vercel build) — cast at the call site per
// project convention.
type BookOrderDb = {
  bookOrder: {
    update: (a: unknown) => Promise<{ id: string; userId: string } | unknown>;
  };
};

const GIFT_MEMBERSHIP_PRODUCT_SLUG = "free-90-day-book-gift";

// Grants the same free 90-day gift membership the book's in-cover QR code
// grants (src/pages/api/redeem.ts) — a direct on-site purchase gets the
// membership automatically, no physical code needed.
async function grantFreeBookGiftMembership(userId: string): Promise<void> {
  const giftPrice = await db.price.findFirst({
    where: { product: { slug: GIFT_MEMBERSHIP_PRODUCT_SLUG } },
    select: { id: true, membershipRole: true },
  });
  if (!giftPrice || !giftPrice.membershipRole) return;

  const grantedRole = giftPrice.membershipRole;
  const currentPeriodEnd = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { role: grantedRole } });
    const membershipTx = tx as never as MembershipDb;
    await membershipTx.userMembership.upsert({
      where: { userId } as unknown as Record<string, unknown>,
      create: {
        userId,
        priceId: giftPrice.id,
        source: "GIFT_CODE",
        status: "ACTIVE",
        currentPeriodEnd,
      },
      update: {
        priceId: giftPrice.id,
        source: "GIFT_CODE",
        status: "ACTIVE",
        currentPeriodEnd,
        stripeSubscriptionId: null,
        cancelAtPeriodEnd: false,
        trialEnd: null,
        updatedAt: new Date(),
      },
    } as unknown as Record<string, unknown>);
  });

  enrollInJourneys({ trigger: "ROLE_CHANGE", userId, triggerConfig: { role: grantedRole, source: "GIFT_CODE" } }).catch(() => {});
}

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

export async function handleSubscriptionUpsert(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const userId = await userIdFromCustomer(customerId);
  const priceId = sub.items.data[0]?.price?.metadata?.priceId;
  if (!userId) return;
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
  // Newer Stripe API versions (this app is pinned to 2025-02-24.acacia) moved
  // current_period_end/start off the top-level Subscription object down onto
  // each subscription item, to support multiple billing periods per
  // subscription — the top-level field is undefined now. Fall back to the
  // item-level field so this doesn't silently produce an Invalid Date.
  const rawSub = sub as unknown as {
    current_period_end?: number;
    trial_end: number | null;
    items: { data: Array<{ current_period_end?: number }> };
  };
  const currentPeriodEndSeconds = rawSub.current_period_end ?? rawSub.items.data[0]?.current_period_end;
  const currentPeriodEnd = new Date((currentPeriodEndSeconds ?? 0) * 1000);
  const trialEnd = rawSub.trial_end ? new Date(rawSub.trial_end * 1000) : null;

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

      // Establish the Morning Boost opt-in default on first grant only --
      // ensureDefaultMorningBoostConsent is a no-op if the contact already
      // has consent history, so this is safe to run on renewals too.
      const grantedUser = await db.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
      if (grantedUser?.email) {
        const contactId = await ensureContactForUser(userId, grantedUser.email, grantedUser.name, "stripe_subscription");
        await ensureDefaultMorningBoostConsent(contactId, "stripe_subscription");
      }
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
      } else if (cs.metadata?.bookOrderId) {
        // Direct on-site book purchase (separate flow from the membership
        // subscription checkout — see create-book-session.ts).
        const bookOrderId = cs.metadata.bookOrderId;
        const shipping = (cs as unknown as {
          shipping_details?: {
            name?: string | null;
            address?: {
              line1?: string | null;
              line2?: string | null;
              city?: string | null;
              state?: string | null;
              postal_code?: string | null;
              country?: string | null;
            } | null;
          } | null;
        }).shipping_details;

        const bookOrderDb = db as never as BookOrderDb;
        const updated = (await bookOrderDb.bookOrder.update({
          where: { id: bookOrderId },
          data: {
            status: "PAID",
            amountPaid: cs.amount_total,
            shippingName: shipping?.name ?? null,
            shippingAddressLine1: shipping?.address?.line1 ?? null,
            shippingAddressLine2: shipping?.address?.line2 ?? null,
            shippingCity: shipping?.address?.city ?? null,
            shippingState: shipping?.address?.state ?? null,
            shippingPostalCode: shipping?.address?.postal_code ?? null,
            shippingCountry: shipping?.address?.country ?? null,
          },
        })) as { id: string; userId: string };

        const userId = updated.userId ?? cs.metadata.userId;
        if (userId) {
          // Same free 90-day gift membership the QR-code flow grants.
          await grantFreeBookGiftMembership(userId);

          // A separate, purchase-receipt-focused email — distinct from the
          // membership-welcome email the ROLE_CHANGE journey above sends.
          enrollInJourneys({ trigger: "BOOK_PURCHASED" as never, userId }).catch(() => {});
        }
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
              // Same field-location fix as handleSubscriptionUpsert — see
              // comment there for why the top-level field is undefined now.
              const rawSubForReceipt = sub as unknown as {
                current_period_end?: number;
                items: { data: Array<{ current_period_end?: number }> };
              };
              const periodEndSeconds = rawSubForReceipt.current_period_end ?? rawSubForReceipt.items.data[0]?.current_period_end;
              const periodEnd = new Date((periodEndSeconds ?? 0) * 1000);
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

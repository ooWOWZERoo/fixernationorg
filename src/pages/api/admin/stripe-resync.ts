import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { handleSubscriptionUpsert } from "@/pages/api/webhooks/stripe";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

// Manual reconciliation between a User's real Stripe subscription state and
// our UserMembership record. Exists because Stripe never retries a webhook
// event that already received a 200 response, even if the handler failed
// internally after responding — so a webhook bug fixed today can't recover
// data lost before the fix landed on its own. Two modes:
//
//   GET  ?scanOrphaned=1   - find every User with a stripeCustomerId but no
//                            UserMembership row (candidates for resync)
//   GET  ?email=...        - inspect one user's current stored state
//   POST { email }         - re-fetch their real Stripe subscription and
//                            run it through the same upsert logic the
//                            webhook uses

type MembershipDb = {
  userMembership: {
    findFirst: (a: unknown) => Promise<{ userId: string } | null>;
    findMany: (a: unknown) => Promise<{ userId: string }[]>;
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const membershipDb = db as never as MembershipDb;

  if (req.method === "GET") {
    if (req.query.scanOrphaned) {
      const usersWithCustomer = await db.user.findMany({
        where: { stripeCustomerId: { not: null } },
        select: { id: true, email: true, stripeCustomerId: true },
      });
      const memberships = await membershipDb.userMembership.findMany({
        where: { userId: { in: usersWithCustomer.map((u) => u.id) } } as unknown as Record<string, unknown>,
      });
      const hasM = new Set(memberships.map((m) => m.userId));
      const orphaned = usersWithCustomer.filter((u) => !hasM.has(u.id));
      return res.status(200).json({ totalWithStripeCustomer: usersWithCustomer.length, orphaned });
    }

    const email = req.query.email as string | undefined;
    if (!email) return res.status(400).json({ error: "email or scanOrphaned required" });
    const user = await db.user.findUnique({
      where: { email },
      select: {
        id: true, email: true, role: true, adminRole: true, stripeCustomerId: true,
        emailVerified: true, passwordHash: true,
      },
    });
    if (!user) return res.status(404).json({ error: "no user with that email" });
    const { passwordHash, ...userWithoutHash } = user;
    const membership = await membershipDb.userMembership.findFirst({
      where: { userId: user.id } as unknown as Record<string, unknown>,
    });
    return res.status(200).json({ user: { ...userWithoutHash, hasPassword: !!passwordHash }, membership });
  }

  if (req.method === "POST") {
    const email = req.body?.email as string | undefined;
    if (!email) return res.status(400).json({ error: "email required" });

    const user = await db.user.findUnique({ where: { email }, select: { id: true, stripeCustomerId: true } });
    if (!user) return res.status(404).json({ error: "no user with that email" });
    if (!user.stripeCustomerId) return res.status(400).json({ error: "user has no stripeCustomerId" });

    const stripe = getStripe();
    const subs = await stripe.subscriptions.list({ customer: user.stripeCustomerId, status: "all", limit: 5 });
    if (subs.data.length === 0) {
      return res.status(404).json({ error: "no Stripe subscriptions found for this customer" });
    }
    const sub = subs.data.sort((a, b) => b.created - a.created)[0];
    await handleSubscriptionUpsert(sub);
    return res.status(200).json({ resyncedSubscriptionId: sub.id, status: sub.status, totalSubscriptionsFound: subs.data.length });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}

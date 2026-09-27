import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import crypto from "crypto";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAction, getClientIp } from "@/lib/audit";
import { sendTransactionalEmail } from "@/lib/email";
import { loadTemplate } from "@/lib/template-engine";
import { buildManualGrantWelcomeEmail } from "@/lib/emails/membership";
import { ensureContactForUser, ensureDefaultMorningBoostConsent } from "@/lib/contacts";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];
const BASE_URL = process.env.NEXTAUTH_URL ?? "https://fixernation.org";

// Admin-initiated, first-time-access link with no urgency — matches the
// window applications/invite/[id].ts uses, rather than the 1hr/24hr windows
// for routine self-service reset requests.
const SET_PASSWORD_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// UserMembership isn't known to the local Prisma client yet (regenerates on
// the next Vercel build) — cast at the call site per project convention.
type MembershipDb = {
  userMembership: {
    create: (a: unknown) => Promise<{ id: string }>;
  };
};

const Schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("A valid email is required"),
  priceId: z.string().min(1, "Choose a membership plan"),
  currentPeriodEnd: z.string().datetime().nullish(),
  note: z.string().trim().max(500).optional(),
});

// Creates a brand-new account plus a real, tracked UserMembership in one
// motion, for a customer who already paid on our previous platform (Wix) and
// has no account here. Deliberately replicates the same side-effect set as
// the Stripe webhook's handleSubscriptionUpsert new-membership branch (role
// grant, CRM contact, Morning Boost consent default, welcome email) so a
// manual grant behaves identically to a real purchase downstream.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
  }

  const { name, email, priceId, note } = parsed.data;

  // This tool is only for genuinely new accounts. Postgres uniqueness on
  // User.email is case-sensitive, so a plain findUnique would happily let an
  // admin create "John@x.com" alongside an existing "john@x.com" and split
  // one person across two accounts. Check case-insensitively instead.
  const existing = await db.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true },
  });
  if (existing) {
    return res.status(409).json({
      error: `An account already exists for ${existing.email}. This tool only creates new accounts — use the Users list to set a password, resend verification, or change their role.`,
      existingUserId: existing.id,
    });
  }

  const price = await db.price.findUnique({
    where: { id: priceId },
    select: {
      id: true,
      active: true,
      membershipRole: true,
      product: { select: { name: true, type: true } },
    },
  });
  if (!price) return res.status(404).json({ error: "That plan no longer exists." });
  if (!price.active) return res.status(400).json({ error: "That plan is no longer active." });
  if (price.product.type !== "MEMBERSHIP") {
    return res.status(400).json({ error: "That plan isn't a membership plan." });
  }

  let currentPeriodEnd: Date | null = null;
  if (parsed.data.currentPeriodEnd) {
    const end = new Date(parsed.data.currentPeriodEnd);
    if (Number.isNaN(end.getTime())) {
      return res.status(400).json({ error: "That expiry date isn't valid." });
    }
    if (end.getTime() <= Date.now()) {
      return res.status(400).json({ error: "The expiry date has to be in the future." });
    }
    currentPeriodEnd = end;
  }

  const grantedRole = price.membershipRole ?? "MEMBER";
  const planName = price.product.name;

  // Account and membership land together or not at all — a User with no
  // UserMembership row would look like a free signup to every downstream
  // report, and a membership with no user can't exist.
  let user: { id: string; email: string; name: string | null };
  try {
    user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          name,
          passwordHash: null,
          // The admin has confirmed this person's identity out-of-band (they
          // paid us on the old platform), and the set-password link below
          // already proves control of the mailbox.
          emailVerified: new Date(),
          role: grantedRole,
        },
        select: { id: true, email: true, name: true },
      });

      await (tx as never as MembershipDb).userMembership.create({
        data: {
          userId: created.id,
          priceId: price.id,
          status: "ACTIVE",
          currentPeriodEnd,
          source: "MANUAL_GRANT",
          stripeSubscriptionId: null,
          stripeCustomerId: null,
        } as unknown as Record<string, unknown>,
      });

      return created;
    });
  } catch (err) {
    console.error("[grant-membership] account + membership creation failed:", err);
    return res.status(500).json({ error: "Couldn't create the account. Nothing was saved." });
  }

  // Same CRM/consent pair the Stripe webhook runs on a first grant.
  // ensureDefaultMorningBoostConsent never overrides an existing choice.
  try {
    const contactId = await ensureContactForUser(user.id, user.email, user.name, "manual_grant");
    await ensureDefaultMorningBoostConsent(contactId, "manual_grant");
  } catch (err) {
    console.error("[grant-membership] contact/consent setup failed:", err);
  }

  // Exact token pattern from forgot-password.ts (delete-then-create on the
  // same identifier) so reset-password.ts can consume it unchanged.
  const token = crypto.randomBytes(32).toString("hex");
  const setPasswordUrl = `${BASE_URL}/reset-password?token=${token}`;
  let emailSent = false;
  try {
    await db.verificationToken.deleteMany({ where: { identifier: `reset:${user.email}` } });
    await db.verificationToken.create({
      data: {
        identifier: `reset:${user.email}`,
        token,
        expires: new Date(Date.now() + SET_PASSWORD_TOKEN_TTL_MS),
      },
    });

    const built =
      (await loadTemplate("membership.manual_grant_welcome", {
        first_name: (user.name ?? "").split(" ")[0] || "there",
        plan_name: planName,
        set_password_url: setPasswordUrl,
      })) ?? buildManualGrantWelcomeEmail(user.name, planName, setPasswordUrl);

    await sendTransactionalEmail({ to: user.email, ...built });
    emailSent = true;
  } catch (err) {
    // The account and membership already exist at this point, so a mail
    // hiccup must not read as a failed grant. Report it instead and hand the
    // admin the link so they can deliver it another way.
    console.error("[grant-membership] set-password email failed:", err);
  }

  await logAction({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "user.membership_manually_granted",
    resource: "User",
    resourceId: user.id,
    metadata: {
      targetEmail: user.email,
      priceId: price.id,
      planName,
      grantedRole,
      currentPeriodEnd: currentPeriodEnd?.toISOString() ?? null,
      note: note ?? null,
      emailSent,
    },
    ip: getClientIp(req),
  });

  return res.status(201).json({
    ok: true,
    userId: user.id,
    email: user.email,
    grantedRole,
    planName,
    currentPeriodEnd: currentPeriodEnd?.toISOString() ?? null,
    emailSent,
    // Only surfaced when the email didn't go out — the admin needs some way
    // to get the new member in. Not an escalation: this admin can already
    // set any non-Super-Admin password outright.
    ...(emailSent ? {} : { setPasswordUrl }),
  });
}

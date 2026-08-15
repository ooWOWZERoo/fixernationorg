import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { randomBytes } from "crypto";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import {
  buildApplicationSubmittedEmail,
  buildApplicationAdminNotifyEmail,
} from "@/lib/emails/application-submitted";

const schema = z.object({
  firstName:            z.string().min(1).max(60).trim(),
  lastName:             z.string().min(1).max(60).trim(),
  email:                z.string().email().trim().toLowerCase(),
  phone:                z.string().min(7).max(25).trim(),
  city:                 z.string().max(80).trim().optional(),
  state:                z.string().max(60).optional(),
  referralCode:         z.string().max(50).trim().optional(),
  campaignSource:       z.string().max(100).optional(),
  occupation:           z.string().max(100).trim().optional(),
  employer:             z.string().max(150).trim().optional(),
  howHeardAboutFN:      z.string().max(100).optional(),
  memberSince:          z.string().max(50).optional(),
  audienceSize:         z.string().max(30).optional(),
  platformsUsed:        z.array(z.string().max(50)).max(15).optional(),
  communityDescription: z.string().max(3000).trim().optional(),
  geographicFocus:      z.string().max(50).optional(),
  whyJoining:           z.string().max(3000).trim().optional(),
  missionAlignment:     z.string().max(3000).trim().optional(),
  referralNetwork:      z.string().max(3000).trim().optional(),
  linkedinUrl:          z.string().max(300).optional(),
  facebookUrl:          z.string().max(300).optional(),
  instagramUrl:         z.string().max(300).optional(),
  tiktokUrl:            z.string().max(300).optional(),
  youtubeUrl:           z.string().max(300).optional(),
  podcastUrl:           z.string().max(300).optional(),
  blogUrl:              z.string().max(300).optional(),
  agreedToAccuracy:     z.boolean(),
  agreedToPolicy:       z.boolean(),
  agreedToContact:      z.boolean(),
  signatureName:        z.string().min(2).max(120).trim(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }

  const d = parsed.data;

  if (!d.agreedToAccuracy || !d.agreedToPolicy || !d.agreedToContact) {
    return res.status(400).json({ error: "All agreements are required." });
  }

  const session = await getServerSession(req, res, authOptions);

  const existing = await db.userApplication.findFirst({
    where: {
      email: d.email,
      type: "AMBASSADOR",
      status: { notIn: ["DRAFT", "WITHDRAWN", "EXPIRED", "REJECTED", "DECLINED"] },
    },
    select: { id: true, status: true },
  });

  if (existing) {
    return res.status(409).json({
      error: "An active application already exists for this email address.",
      existing: { id: existing.id, status: existing.status },
    });
  }

  const emailVerifyToken = randomBytes(32).toString("hex");

  const application = await db.userApplication.create({
    data: {
      type: "AMBASSADOR",
      status: "SUBMITTED",
      name: `${d.firstName} ${d.lastName}`,
      email: d.email,
      phone: d.phone,
      message: d.whyJoining?.trim() || null,
      userId: session?.user?.id ?? null,
      referralCode: d.referralCode || null,
      campaignSource: d.campaignSource || null,
      submittedAt: new Date(),
      emailVerifyToken,
      draftExpiresAt: null,
      ambassadorDetail: {
        create: {
          firstName: d.firstName,
          lastName: d.lastName,
          phone: d.phone,
          city: d.city || null,
          state: d.state || null,
          occupation: d.occupation || null,
          employer: d.employer || null,
          howHeardAboutFN: d.howHeardAboutFN || null,
          memberSince: d.memberSince || null,
          audienceSize: d.audienceSize || null,
          platformsUsed: d.platformsUsed ?? [],
          communityDescription: d.communityDescription || null,
          geographicFocus: d.geographicFocus || null,
          whyJoining: d.whyJoining || null,
          missionAlignment: d.missionAlignment || null,
          referralNetwork: d.referralNetwork || null,
          linkedinUrl: d.linkedinUrl || null,
          facebookUrl: d.facebookUrl || null,
          instagramUrl: d.instagramUrl || null,
          tiktokUrl: d.tiktokUrl || null,
          youtubeUrl: d.youtubeUrl || null,
          podcastUrl: d.podcastUrl || null,
          blogUrl: d.blogUrl || null,
          agreedToAccuracy: d.agreedToAccuracy,
          agreedToPolicy: d.agreedToPolicy,
          agreedToContact: d.agreedToContact,
          signatureName: d.signatureName,
          agreedAt: new Date(),
        },
      },
    },
  });

  const notifyEmail = process.env.ADMIN_NOTIFY_EMAIL ?? process.env.SMTP_FROM;
  const [submittedEmail, adminEmail] = await Promise.allSettled([
    sendEmail({ to: d.email, ...buildApplicationSubmittedEmail(d.firstName, "AMBASSADOR", emailVerifyToken) }),
    notifyEmail
      ? sendEmail({ to: notifyEmail, ...buildApplicationAdminNotifyEmail(`${d.firstName} ${d.lastName}`, "AMBASSADOR", application.id) })
      : Promise.resolve(),
  ]);

  if (submittedEmail.status === "rejected") {
    console.error("[application/ambassador] Failed to send confirmation email:", submittedEmail.reason);
  }
  if (adminEmail.status === "rejected") {
    console.error("[application/ambassador] Failed to send admin notify email:", adminEmail.reason);
  }

  return res.status(201).json({ id: application.id });
}

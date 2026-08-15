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
import { applyApplicationTags } from "@/lib/application-crm";

const schema = z.object({
  firstName:         z.string().min(1).max(60).trim(),
  lastName:          z.string().min(1).max(60).trim(),
  email:             z.string().email().trim().toLowerCase(),
  phone:             z.string().min(7).max(25).trim(),
  referralCode:      z.string().max(50).trim().optional(),
  campaignSource:    z.string().max(100).optional(),
  businessName:      z.string().max(150).trim().optional(),
  businessType:      z.string().max(60).optional(),
  yearsInBusiness:   z.string().max(30).optional(),
  website:           z.string().max(300).optional(),
  licenseNumber:     z.string().max(100).optional(),
  insuranceCarrier:  z.string().max(150).optional(),
  insuranceExpiry:   z.string().max(50).optional(),
  serviceCategory:   z.string().max(100).optional(),
  serviceDescription: z.string().max(3000).trim().optional(),
  serviceAreas:      z.array(z.string().max(100)).max(20).optional(),
  pricingModel:      z.string().max(60).optional(),
  priceRange:        z.string().max(100).optional(),
  whyJoining:        z.string().max(3000).trim().optional(),
  targetAudience:    z.string().max(3000).trim().optional(),
  differentiation:   z.string().max(3000).trim().optional(),
  linkedinUrl:       z.string().max(300).optional(),
  facebookUrl:       z.string().max(300).optional(),
  instagramUrl:      z.string().max(300).optional(),
  otherSocialUrl:    z.string().max(300).optional(),
  agreedToAccuracy:  z.boolean(),
  agreedToPolicy:    z.boolean(),
  agreedToContact:   z.boolean(),
  signatureName:     z.string().min(2).max(120).trim(),
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
      type: "PROVIDER",
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
      type: "PROVIDER",
      status: "SUBMITTED",
      name: `${d.firstName} ${d.lastName}`,
      email: d.email,
      phone: d.phone,
      message: d.serviceDescription?.trim() || null,
      businessName: d.businessName || null,
      userId: session?.user?.id ?? null,
      referralCode: d.referralCode || null,
      campaignSource: d.campaignSource || null,
      submittedAt: new Date(),
      emailVerifyToken,
      draftExpiresAt: null,
      providerDetail: {
        create: {
          firstName: d.firstName,
          lastName: d.lastName,
          phone: d.phone,
          businessName: d.businessName || null,
          businessType: d.businessType || null,
          yearsInBusiness: d.yearsInBusiness || null,
          website: d.website || null,
          licenseNumber: d.licenseNumber || null,
          insuranceCarrier: d.insuranceCarrier || null,
          insuranceExpiry: d.insuranceExpiry || null,
          serviceCategory: d.serviceCategory || null,
          serviceDescription: d.serviceDescription || null,
          serviceAreas: d.serviceAreas ?? [],
          pricingModel: d.pricingModel || null,
          priceRange: d.priceRange || null,
          whyJoining: d.whyJoining || null,
          targetAudience: d.targetAudience || null,
          differentiation: d.differentiation || null,
          linkedinUrl: d.linkedinUrl || null,
          facebookUrl: d.facebookUrl || null,
          instagramUrl: d.instagramUrl || null,
          otherSocialUrl: d.otherSocialUrl || null,
          agreedToAccuracy: d.agreedToAccuracy,
          agreedToPolicy: d.agreedToPolicy,
          agreedToContact: d.agreedToContact,
          signatureName: d.signatureName,
          agreedAt: new Date(),
        },
      },
    },
  });

  // Sync CRM contact + tags — fire and forget
  applyApplicationTags({
    id: application.id,
    email: d.email,
    name: `${d.firstName} ${d.lastName}`,
    type: "PROVIDER",
    status: "SUBMITTED",
    userId: session?.user?.id ?? null,
  }).catch((err) => console.error("[application/provider] CRM sync failed:", err));

  const notifyEmail = process.env.ADMIN_NOTIFY_EMAIL ?? process.env.SMTP_FROM;
  const [submittedEmail, adminEmail] = await Promise.allSettled([
    sendEmail({ to: d.email, ...buildApplicationSubmittedEmail(d.firstName, "PROVIDER", emailVerifyToken) }),
    notifyEmail
      ? sendEmail({ to: notifyEmail, ...buildApplicationAdminNotifyEmail(`${d.firstName} ${d.lastName}`, "PROVIDER", application.id) })
      : Promise.resolve(),
  ]);

  if (submittedEmail.status === "rejected") {
    console.error("[application/provider] Failed to send confirmation email:", submittedEmail.reason);
  }
  if (adminEmail.status === "rejected") {
    console.error("[application/provider] Failed to send admin notify email:", adminEmail.reason);
  }

  return res.status(201).json({ id: application.id });
}

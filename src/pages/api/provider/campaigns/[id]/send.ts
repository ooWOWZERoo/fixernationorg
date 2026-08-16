import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";

const PROVIDER_ROLES = ["PROVIDER", "ADMIN", "SUPER_ADMIN"];

type ProviderCampaignDb = {
  providerCampaign: {
    findFirst: (a: unknown) => Promise<unknown | null>;
    update: (a: unknown) => Promise<unknown>;
  };
};

type ProviderContactDb = {
  providerContact: {
    findMany: (a: unknown) => Promise<unknown[]>;
  };
};

type ProviderCampaignSendDb = {
  providerCampaignSend: {
    createMany: (a: unknown) => Promise<{ count: number }>;
    updateMany: (a: unknown) => Promise<{ count: number }>;
  };
};

type CampaignRecord = {
  id: string;
  providerUserId: string;
  name: string;
  subject: string;
  fromName: string;
  htmlBody: string;
  textBody: string | null;
  status: string;
};

type ContactRecord = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || !PROVIDER_ROLES.includes(session.user.role)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id } = req.query;
  if (typeof id !== "string") return res.status(400).json({ error: "Invalid id" });

  const cdb = db as never as ProviderCampaignDb;
  const pdb = db as never as ProviderContactDb;
  const sdb = db as never as ProviderCampaignSendDb;

  const campaign = await cdb.providerCampaign.findFirst({
    where: { id, providerUserId: session.user.id },
  }) as CampaignRecord | null;

  if (!campaign) return res.status(404).json({ error: "Campaign not found" });
  if (campaign.status !== "DRAFT") {
    return res.status(409).json({ error: "This campaign has already been sent." });
  }

  const contacts = await pdb.providerContact.findMany({
    where: { providerUserId: session.user.id },
    select: { id: true, email: true, firstName: true, lastName: true },
  }) as ContactRecord[];

  if (contacts.length === 0) {
    return res.status(400).json({ error: "You have no contacts to send to. Add contacts first." });
  }

  await cdb.providerCampaign.update({
    where: { id },
    data: { status: "SENDING" },
  });

  await sdb.providerCampaignSend.createMany({
    data: contacts.map((c) => ({
      campaignId: id,
      providerContactId: c.id,
      status: "QUEUED",
    })),
    skipDuplicates: true,
  });

  const fromDisplay = `${campaign.fromName} via Fixer Nation <campaigns@fixernation.org>`;
  const footer = `<br><br><hr style="border:none;border-top:1px solid #eee"><p style="font-size:12px;color:#999">Sent by ${campaign.fromName} through Fixer Nation. Questions? Contact <a href="mailto:support@fixernation.org">support@fixernation.org</a>.</p>`;
  const textFooter = `\n\n---\nSent by ${campaign.fromName} through Fixer Nation. Questions? support@fixernation.org`;

  let sent = 0;
  let failed = 0;
  const failedIds: string[] = [];

  for (const contact of contacts) {
    try {
      await sendEmail({
        to: contact.email,
        subject: campaign.subject,
        html: campaign.htmlBody + footer,
        text: (campaign.textBody ?? campaign.subject) + textFooter,
        from: fromDisplay,
      });
      await sdb.providerCampaignSend.updateMany({
        where: { campaignId: id, providerContactId: contact.id },
        data: { status: "SENT", sentAt: new Date() },
      });
      sent++;
    } catch {
      await sdb.providerCampaignSend.updateMany({
        where: { campaignId: id, providerContactId: contact.id },
        data: { status: "FAILED" },
      });
      failedIds.push(contact.id);
      failed++;
    }
  }

  await cdb.providerCampaign.update({
    where: { id },
    data: {
      status: sent > 0 ? "SENT" : "DRAFT",
      sentAt: sent > 0 ? new Date() : null,
    },
  });

  return res.status(200).json({ sent, failed, total: contacts.length });
}

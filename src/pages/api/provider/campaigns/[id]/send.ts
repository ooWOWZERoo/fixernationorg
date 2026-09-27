import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { continueProviderCampaignSend } from "@/lib/send-provider-campaign";

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
  };
};

type CampaignRecord = {
  id: string;
  providerUserId: string;
  status: string;
};

type ContactRecord = { id: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || (session.user.role !== "PROVIDER" && !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole))) {
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
    select: { id: true },
  }) as ContactRecord[];

  if (contacts.length === 0) {
    return res.status(400).json({ error: "You have no contacts to send to. Add contacts first." });
  }

  // Queue the whole audience up front, then flip to SENDING. Doing it in this
  // order means a crash between the two leaves rows that the drain simply
  // ignores (it only touches SENDING campaigns) rather than a SENDING
  // campaign with no queue behind it.
  await sdb.providerCampaignSend.createMany({
    data: contacts.map((c) => ({ campaignId: id, providerContactId: c.id, status: "QUEUED" })),
    skipDuplicates: true,
  });

  await cdb.providerCampaign.update({ where: { id }, data: { status: "SENDING" } });

  // Drain what this invocation's time budget and the mailbox's remaining
  // hourly budget allow, then hand the rest to the hourly resume cron. This
  // request no longer waits on the full audience the way the old serial loop
  // did — it returns as soon as either budget is spent, and the campaign stays
  // SENDING until the queue is actually empty.
  const result = await continueProviderCampaignSend(id);

  return res.status(200).json({
    sent: result.sent,
    failed: result.failed,
    total: contacts.length,
    queued: contacts.length - result.sent - result.failed,
    done: result.done,
    pausedForHourlyCap: result.hourlyCapReached,
  });
}

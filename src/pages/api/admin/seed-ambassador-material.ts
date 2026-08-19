/**
 * One-time endpoint to seed a stable SENT campaign flagged as ambassador
 * material, so the /account/ambassador/materials page has known, repeatable
 * content for the Playwright suite. Idempotent — upserts by name.
 * POST /api/admin/seed-ambassador-material — SUPER_ADMIN only.
 * Remove this file after the campaign is created and confirmed.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const NAME = "QA e2e ambassador material";
const SUBJECT = "QA e2e test subject — ambassador material";
const HTML_BODY = "<p>QA e2e test HTML body for the ambassador materials flow.</p>";
const TEXT_BODY = "QA e2e test plain text body for the ambassador materials flow.";

type CampaignRow = { id: string; name: string };
type CampaignDb = {
  campaign: {
    findFirst: (a: unknown) => Promise<CampaignRow | null>;
    create: (a: unknown) => Promise<CampaignRow>;
    update: (a: unknown) => Promise<CampaignRow>;
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (session?.user?.adminRole !== "SUPER_ADMIN") {
    return res.status(401).json({ error: "SUPER_ADMIN required" });
  }

  const db_ = db as never as CampaignDb;
  const data = {
    name: NAME,
    subject: SUBJECT,
    htmlBody: HTML_BODY,
    textBody: TEXT_BODY,
    status: "SENT",
    channelType: "EMAIL",
    isAmbassadorMaterial: true,
    sentAt: new Date(),
  };

  const existing = await db_.campaign.findFirst({ where: { name: NAME } });
  const campaign = existing
    ? await db_.campaign.update({ where: { id: existing.id }, data })
    : await db_.campaign.create({ data });

  return res.json({ ok: true, id: campaign.id, name: campaign.name });
}

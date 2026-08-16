import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";



type ProviderCampaignDb = {
  providerCampaign: {
    findMany: (a: unknown) => Promise<unknown[]>;
    create: (a: unknown) => Promise<unknown>;
  };
};

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  subject: z.string().min(1).max(200),
  fromName: z.string().min(1).max(100),
  htmlBody: z.string().min(1),
  textBody: z.string().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || (session.user.role !== "PROVIDER" && !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole))) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const providerUserId = session.user.id;
  const cdb = db as never as ProviderCampaignDb;

  if (req.method === "GET") {
    const campaigns = await cdb.providerCampaign.findMany({
      where: { providerUserId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        subject: true,
        fromName: true,
        status: true,
        sentAt: true,
        createdAt: true,
        _count: { select: { sends: true } },
      },
    }) as Array<{
      id: string;
      name: string;
      subject: string;
      fromName: string;
      status: string;
      sentAt: string | null;
      createdAt: string;
      _count: { sends: number };
    }>;

    return res.status(200).json({
      campaigns: campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        subject: c.subject,
        fromName: c.fromName,
        status: c.status,
        sentAt: c.sentAt,
        createdAt: c.createdAt,
        sendCount: c._count.sends,
      })),
    });
  }

  if (req.method === "POST") {
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
    }

    const { name, subject, fromName, htmlBody, textBody } = parsed.data;

    const campaign = await cdb.providerCampaign.create({
      data: {
        providerUserId,
        name,
        subject,
        fromName,
        htmlBody,
        textBody: textBody || null,
        status: "DRAFT",
      },
    }) as { id: string };

    return res.status(201).json({ campaign });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}

import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";



type ProviderCampaignDb = {
  providerCampaign: {
    findFirst: (a: unknown) => Promise<unknown | null>;
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || (session.user.role !== "PROVIDER" && !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole))) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id } = req.query;
  if (typeof id !== "string") return res.status(400).json({ error: "Invalid id" });

  const cdb = db as never as ProviderCampaignDb;

  const campaign = await cdb.providerCampaign.findFirst({
    where: { id, providerUserId: session.user.id },
    include: {
      sends: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          sentAt: true,
          contact: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      },
    },
  });

  if (!campaign) return res.status(404).json({ error: "Not found" });
  return res.status(200).json({ campaign });
}

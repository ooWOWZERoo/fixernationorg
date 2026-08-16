import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";



export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || (session.user.role !== "AMBASSADOR" && !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole))) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const campaigns = await db.campaign.findMany({
    where: {
      isAmbassadorMaterial: true,
      status: "SENT",
    } as never,
    select: {
      id: true,
      name: true,
      subject: true,
      channelType: true,
      htmlBody: true,
      textBody: true,
      pushUrl: true,
      sentAt: true,
    } as never,
    orderBy: { sentAt: "desc" },
  });

  return res.status(200).json({ materials: campaigns });
}

import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/lib/db";
import { trackingHmac } from "@/lib/track";

// 1×1 transparent GIF
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

type SendDb = {
  providerCampaignSend: {
    updateMany: (a: unknown) => Promise<{ count: number }>;
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Content-Type", "image/gif");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");

  const { s: sendId, t: token } = req.query;

  if (typeof sendId === "string" && typeof token === "string" && token === trackingHmac(sendId)) {
    try {
      const sdb = db as never as SendDb;
      await sdb.providerCampaignSend.updateMany({
        where: { id: sendId, openedAt: null },
        data: { openedAt: new Date() },
      });
    } catch {
      // fire-and-forget — pixel still returns regardless
    }
  }

  return res.status(200).send(PIXEL);
}

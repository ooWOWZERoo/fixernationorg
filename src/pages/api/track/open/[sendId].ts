import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/lib/db";

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { sendId } = req.query as { sendId: string };

  // Fire-and-forget — never block the image response on DB writes
  db.campaignSend
    .updateMany({
      where: { id: sendId, openedAt: null },
      data: { openedAt: new Date(), status: "OPENED" },
    })
    .catch(() => {});

  res.setHeader("Content-Type", "image/gif");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  return res.status(200).send(PIXEL);
}

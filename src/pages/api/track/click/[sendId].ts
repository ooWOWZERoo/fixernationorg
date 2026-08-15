import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { sendId, url } = req.query as { sendId: string; url?: string };

  const target = url && isAllowedUrl(url) ? url : "/";

  // Fire-and-forget
  db.campaignSend
    .updateMany({
      where: { id: sendId, clickedAt: null },
      data: { clickedAt: new Date(), status: "CLICKED" },
    })
    .catch(() => {});

  return res.redirect(302, target);
}

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Only allow https links to fixernation.org or relative paths
    return parsed.protocol === "https:" && parsed.hostname.endsWith("fixernation.org");
  } catch {
    return false;
  }
}

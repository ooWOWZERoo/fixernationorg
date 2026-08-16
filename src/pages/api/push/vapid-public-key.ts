import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!process.env.VAPID_PUBLIC_KEY) {
    return res.status(503).json({ error: "Push notifications not configured" });
  }
  return res.status(200).json({ publicKey: process.env.VAPID_PUBLIC_KEY });
}

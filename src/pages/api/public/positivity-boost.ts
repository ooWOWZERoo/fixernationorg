import type { NextApiRequest, NextApiResponse } from "next";
import { getTodaysPositivityBoost } from "@/lib/positivityBoost";

// Thin read-only wrapper around the same selector the homepage's
// getServerSideProps calls directly -- kept for e2e-test convenience and
// future reuse (mobile, a client-side refresh affordance, etc.), never a
// second implementation of the selection logic.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const boost = await getTodaysPositivityBoost();
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
  return res.status(200).json(boost);
}

import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/lib/db";

// ONE-TIME fix endpoint: sets adminRole=SUPER_ADMIN for johnfshaw@yahoo.com
// Protected by CRON_SECRET. Delete this file after running once.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const secret = req.query.secret as string;
  if (!secret || secret !== process.env.CRON_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const before = await db.user.findUnique({
    where: { email: "johnfshaw@yahoo.com" },
    select: { id: true, email: true, role: true, adminRole: true },
  });

  if (!before) {
    return res.status(404).json({ error: "User not found" });
  }

  if (before.adminRole === "SUPER_ADMIN") {
    return res.status(200).json({ ok: true, message: "Already SUPER_ADMIN", user: before });
  }

  const after = await db.user.update({
    where: { email: "johnfshaw@yahoo.com" },
    data: { adminRole: "SUPER_ADMIN" },
    select: { id: true, email: true, role: true, adminRole: true },
  });

  return res.status(200).json({ ok: true, message: "Fixed", before, after });
}

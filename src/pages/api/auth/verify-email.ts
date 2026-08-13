import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = req.query.token as string;
  if (!token) return res.redirect("/signin?error=InvalidToken");

  const record = await db.verificationToken.findUnique({ where: { token } });
  if (!record || !record.identifier.startsWith("verify:")) {
    return res.redirect("/signin?error=InvalidToken");
  }
  if (record.expires < new Date()) {
    await db.verificationToken.delete({ where: { token } });
    return res.redirect("/signin?error=ExpiredToken");
  }

  const userId = record.identifier.replace("verify:", "");
  await db.user.update({
    where: { id: userId },
    data: { emailVerified: new Date() },
  });
  await db.verificationToken.delete({ where: { token } });

  return res.redirect("/signin?verified=1");
}

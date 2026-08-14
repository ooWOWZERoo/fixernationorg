import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authenticator } from "otplib";
import qrcode from "qrcode";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, mfaEnabled: true },
  });
  if (!user) return res.status(404).json({ error: "User not found" });
  if (user.mfaEnabled) return res.status(409).json({ error: "MFA is already enabled." });

  const secret = authenticator.generateSecret(20);

  // Store the pending secret (mfaEnabled stays false until verified)
  await db.user.update({
    where: { id: session.user.id },
    data: { mfaSecret: secret },
  });

  const otpauthUrl = authenticator.keyuri(user.email ?? session.user.email ?? "user", "Fixer Nation", secret);
  const qrDataUrl = await qrcode.toDataURL(otpauthUrl);

  return res.status(200).json({ secret, qrDataUrl });
}

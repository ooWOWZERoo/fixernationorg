import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { verifyTOTP } from "@/lib/totp";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({ totpCode: z.string().length(6).regex(/^\d+$/) });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid code format." });

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { mfaEnabled: true, mfaSecret: true },
  });
  if (!user) return res.status(404).json({ error: "User not found" });
  if (!user.mfaEnabled || !user.mfaSecret) return res.status(400).json({ error: "MFA is not enabled." });

  const valid = verifyTOTP(user.mfaSecret, parsed.data.totpCode);
  if (!valid) return res.status(400).json({ error: "That code is incorrect." });

  await db.user.update({
    where: { id: session.user.id },
    data: { mfaEnabled: false, mfaSecret: null },
  });

  return res.status(200).json({ ok: true });
}

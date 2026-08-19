import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// One-time seeding endpoint for a dedicated MFA e2e test account — kept
// isolated from qa-member so mfa.spec.ts never collides with other tests
// running in parallel against the shared member account. Deleted after use.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.adminRole !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const email = "qa-mfa-test@fixernation.org";
  const password = crypto.randomBytes(18).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 12);

  await db.user.upsert({
    where: { email },
    create: {
      email,
      name: "QA MFA Test",
      passwordHash,
      role: "MEMBER",
      emailVerified: new Date(),
    },
    update: { passwordHash, mfaEnabled: false, mfaSecret: null },
  });

  return res.status(200).json({ email, password });
}

/**
 * One-time endpoint to create a dedicated Playwright test member account.
 * POST /api/admin/create-test-account — SUPER_ADMIN only.
 * Idempotent: upserts by email, generates a fresh random password each run.
 * Returns the plaintext password ONCE — capture it into .env.test immediately.
 * Remove this file after the test account is created and credentials are saved.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const TEST_EMAIL = "qa-member@fixernation.org";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (session?.user?.adminRole !== "SUPER_ADMIN") {
    return res.status(401).json({ error: "SUPER_ADMIN required" });
  }

  const password = crypto.randomBytes(18).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await db.user.upsert({
    where: { email: TEST_EMAIL },
    update: {
      passwordHash,
      emailVerified: new Date(),
      role: "MEMBER",
      adminRole: "NONE",
      mfaEnabled: false,
      mfaSecret: null,
    },
    create: {
      name: "QA Test Member",
      email: TEST_EMAIL,
      passwordHash,
      emailVerified: new Date(),
      role: "MEMBER",
      adminRole: "NONE",
    },
  });

  return res.json({
    ok: true,
    email: user.email,
    password,
    note: "Save this password now — it will not be shown again. Store in .env.test as TEST_MEMBER_PASSWORD.",
  });
}

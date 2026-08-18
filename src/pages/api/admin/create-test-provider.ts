/**
 * One-time endpoint to create a dedicated PROVIDER-role QA test account,
 * used by the Playwright suite for the provider campaign flow.
 * POST /api/admin/create-test-provider — SUPER_ADMIN only.
 * Idempotent: upserts by email, generates a fresh random password each run.
 * Returns the plaintext password ONCE — capture immediately.
 * Remove this file after the account is created and details are saved.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const TEST_EMAIL = "qa-provider@fixernation.org";

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
      role: "PROVIDER",
      adminRole: "NONE",
      mfaEnabled: false,
      mfaSecret: null,
    },
    create: {
      name: "QA Test Provider",
      email: TEST_EMAIL,
      passwordHash,
      emailVerified: new Date(),
      role: "PROVIDER",
      adminRole: "NONE",
    },
  });

  return res.json({
    ok: true,
    id: user.id,
    email: user.email,
    password,
    note: "Save the password now — capture as TEST_PROVIDER_EMAIL / TEST_PROVIDER_PASSWORD in .env.test.",
  });
}

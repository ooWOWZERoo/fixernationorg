import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";

const Schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
  }

  const { token, password } = parsed.data;

  const record = await db.verificationToken.findUnique({ where: { token } });
  if (!record || !record.identifier.startsWith("reset:")) {
    return res.status(400).json({ error: "This link is invalid." });
  }
  if (record.expires < new Date()) {
    await db.verificationToken.delete({ where: { token } });
    return res.status(400).json({ error: "This link has expired. Request a new one." });
  }

  const email = record.identifier.replace("reset:", "");
  const user = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return res.status(400).json({ error: "Account not found." });

  const passwordHash = await bcrypt.hash(password, 12);
  await db.user.update({ where: { id: user.id }, data: { passwordHash } });
  await db.verificationToken.delete({ where: { token } });

  return res.json({ ok: true });
}

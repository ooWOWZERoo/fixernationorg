import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const schema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  subject: z.string().min(1).max(200),
  message: z.string().min(10).max(5000),
  _hp: z.string().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Honeypot: silently succeed if bot filled in the hidden field
  if (req.body?._hp) return res.status(200).json({ ok: true });

  const rl = await checkRateLimit(`contact:${getClientIp(req)}`, 5, 60 * 60 * 1000);
  if (!rl.allowed) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Please check your entries and try again." });
  }

  const { name, email, subject, message } = parsed.data;

  await db.contactMessage.create({ data: { name, email, subject, message } });

  return res.status(200).json({ ok: true });
}

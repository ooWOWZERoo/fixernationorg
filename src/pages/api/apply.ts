import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  type: z.enum(["PROVIDER", "AMBASSADOR"]),
  name: z.string().min(2).max(100),
  email: z.string().email(),
  message: z.string().min(20).max(2000),
  businessName: z.string().max(150).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }

  const session = await getServerSession(req, res, authOptions);
  const { type, name, email, message, businessName } = parsed.data;

  const application = await db.userApplication.create({
    data: {
      type,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      message: message.trim(),
      businessName: businessName?.trim() || null,
      userId: session?.user?.id ?? null,
    },
  });

  return res.status(201).json({ id: application.id });
}

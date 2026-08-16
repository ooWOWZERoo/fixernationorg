import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const upsertSchema = z.object({
  key: z.string().min(1).max(200).trim(),
  value: z.string().default(""),
});

const deleteSchema = z.object({
  key: z.string().min(1),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "GET") {
    const settings = await db.setting.findMany({ orderBy: { key: "asc" } });
    return res.status(200).json({ settings });
  }

  if (req.method === "POST") {
    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const { key, value } = parsed.data;
    const setting = await db.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
    return res.status(200).json(setting);
  }

  if (req.method === "DELETE") {
    const parsed = deleteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Key is required" });
    }
    await db.setting.delete({ where: { key: parsed.data.key } });
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "GET, POST, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}

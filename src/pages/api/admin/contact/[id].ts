import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const patchSchema = z.object({
  status: z.enum(["NEW", "READ", "ARCHIVED"]),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id } = req.query as { id: string };

  if (req.method === "PATCH") {
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid status" });
    try {
      const msg = await db.contactMessage.update({
        where: { id },
        data: { status: parsed.data.status },
      });
      return res.status(200).json(msg);
    } catch {
      return res.status(404).json({ error: "Not found" });
    }
  }

  if (req.method === "DELETE") {
    try {
      await db.contactMessage.delete({ where: { id } });
      return res.status(200).json({ ok: true });
    } catch {
      return res.status(404).json({ error: "Not found" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

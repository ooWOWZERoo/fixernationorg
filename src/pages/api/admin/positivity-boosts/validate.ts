import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { validatePositivityBoost, countWords } from "@/lib/positivityValidator";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const schema = z.object({ content: z.string() });

// No DB access at all -- a pure dry-run so an admin can check before saving.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const result = validatePositivityBoost(parsed.data.content);
  return res.status(200).json({ ...result, wordCount: countWords(parsed.data.content) });
}

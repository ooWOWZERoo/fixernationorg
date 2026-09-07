import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { validateTuneBrainContentFields } from "@/lib/tuneBrainContentValidator";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const schema = z.object({
  prompt: z.string().optional(),
  options: z
    .array(z.object({ label: z.string().optional(), explanation: z.string().optional().nullable() }))
    .optional(),
});

// No DB access at all -- a pure dry-run so an admin can check before saving,
// same shape as positivity-boosts/validate.ts.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.adminRole || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const fields = [parsed.data.prompt, ...(parsed.data.options ?? []).flatMap((o) => [o.label, o.explanation])];
  const result = validateTuneBrainContentFields(fields);
  return res.status(200).json(result);
}

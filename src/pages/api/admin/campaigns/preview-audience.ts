import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { previewAudience, type AudienceDefinition } from "@/lib/audience";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { rules } = req.body ?? {};
  if (
    !rules ||
    !Array.isArray(rules.include) ||
    !Array.isArray(rules.exclude)
  ) {
    return res.status(400).json({ error: "Invalid audience rules — expected { include, exclude, logic }" });
  }

  const def: AudienceDefinition = {
    logic: rules.logic === "AND" ? "AND" : "OR",
    include: rules.include,
    exclude: rules.exclude,
  };

  const preview = await previewAudience(def);
  return res.status(200).json(preview);
}

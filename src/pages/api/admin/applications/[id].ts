import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const patchSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reviewNotes: z.string().max(1000).optional(),
});

// Maps application type to the UserRole to grant on approval
const APPROVAL_ROLE: Record<string, "PROVIDER" | "AMBASSADOR"> = {
  PROVIDER: "PROVIDER",
  AMBASSADOR: "AMBASSADOR",
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { id } = req.query as { id: string };

  if (req.method === "PATCH") {
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const { status, reviewNotes } = parsed.data;

    const application = await db.userApplication.findUnique({ where: { id } });
    if (!application) return res.status(404).json({ error: "Not found" });
    if (application.status !== "PENDING") {
      return res.status(409).json({ error: "Application has already been reviewed." });
    }

    // Update the application
    const updated = await db.userApplication.update({
      where: { id },
      data: {
        status,
        reviewedAt: new Date(),
        reviewedBy: session.user.email,
        reviewNotes: reviewNotes?.trim() || null,
      },
    });

    // If approved and we have a userId, update the user's role
    if (status === "APPROVED" && application.userId) {
      const newRole = APPROVAL_ROLE[application.type];
      if (newRole) {
        await db.user.update({
          where: { id: application.userId },
          data: { role: newRole },
        });
      }
    }

    return res.status(200).json(updated);
  }

  res.setHeader("Allow", "PATCH");
  return res.status(405).json({ error: "Method not allowed" });
}

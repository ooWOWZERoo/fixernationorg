import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { validatePositivityBoost } from "@/lib/positivityValidator";
import { POSITIVITY_BOOST_CATEGORIES } from "@/lib/positivityBoostCategories";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const updateSchema = z.object({
  content: z.string().trim().min(1).max(500).optional(),
  category: z.enum(POSITIVITY_BOOST_CATEGORIES).optional(),
  isFallback: z.boolean().optional(),
  status: z.enum(["DRAFT", "APPROVED", "ACTIVE", "INACTIVE", "REJECTED"]).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id } = req.query as { id: string };

  const boost = await db.positivityBoost.findUnique({
    where: { id },
    include: { _count: { select: { assignments: true } } },
  });
  if (!boost) return res.status(404).json({ error: "Not found" });

  if (req.method === "GET") {
    return res.status(200).json(boost);
  }

  if (req.method === "PUT") {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { content, category, isFallback, status: requestedStatus } = parsed.data;

    // Re-validate whenever content changes; otherwise keep the existing
    // validation result (editing category/isFallback/status alone doesn't
    // change whether the text itself is safe).
    const validation = content !== undefined ? validatePositivityBoost(content) : null;
    const validationStatus = validation ? (validation.passed ? "PASSED" : "FAILED") : boost.validationStatus;
    const validationNotes = validation ? validation.notes.join("; ") || null : boost.validationNotes;

    // The one place safety is actually enforced, not just hidden in the UI:
    // content that fails validation can never end up APPROVED/ACTIVE,
    // regardless of what the request asks for. Manually rejecting content
    // that *passed* validation (e.g. for editorial reasons) stays allowed.
    let status = requestedStatus ?? boost.status;
    if (validationStatus === "FAILED" && (status === "APPROVED" || status === "ACTIVE")) {
      if (requestedStatus === "APPROVED" || requestedStatus === "ACTIVE") {
        return res.status(400).json({ error: "Cannot activate content that failed validation." });
      }
      status = "REJECTED";
    }

    try {
      const updated = await db.positivityBoost.update({
        where: { id },
        data: {
          ...(content !== undefined && { content }),
          ...(category !== undefined && { category }),
          ...(isFallback !== undefined && { isFallback }),
          status,
          validationStatus,
          validationNotes,
          ...(status === "APPROVED" && boost.status !== "APPROVED" && {
            approvedAt: new Date(),
            approvedBy: session.user.id,
          }),
        },
      });
      return res.status(200).json(updated);
    } catch (err: unknown) {
      if (err != null && typeof err === "object" && "code" in err) {
        const code = (err as { code: string }).code;
        if (code === "P2002") {
          return res.status(409).json({ error: "That message already exists." });
        }
        console.error(`Prisma error updating positivity boost (${code}):`, err);
        return res.status(500).json({ error: "Database error - please try again." });
      }
      console.error("Error updating positivity boost:", err);
      return res.status(500).json({ error: "An error occurred while saving. Please try again." });
    }
  }

  if (req.method === "DELETE") {
    if (boost._count.assignments > 0) {
      return res.status(400).json({ error: "Cannot delete a message that has display history." });
    }
    await db.positivityBoost.delete({ where: { id } });
    return res.status(204).end();
  }

  res.setHeader("Allow", "GET, PUT, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}

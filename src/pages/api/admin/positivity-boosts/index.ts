import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { validatePositivityBoost } from "@/lib/positivityValidator";
import { POSITIVITY_BOOST_CATEGORIES } from "@/lib/positivityBoostCategories";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const createSchema = z.object({
  content: z.string().trim().min(1).max(500),
  category: z.enum(POSITIVITY_BOOST_CATEGORIES),
  isFallback: z.boolean().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "GET") {
    const boosts = await db.positivityBoost.findMany({
      orderBy: { updatedAt: "desc" },
    });
    return res.status(200).json(boosts);
  }

  if (req.method === "POST") {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    // status/validationStatus are never accepted from the client -- always
    // computed here by the deterministic safety validator.
    const result = validatePositivityBoost(parsed.data.content);

    try {
      const boost = await db.positivityBoost.create({
        data: {
          content: parsed.data.content,
          category: parsed.data.category,
          isFallback: parsed.data.isFallback ?? false,
          status: result.passed ? "DRAFT" : "REJECTED",
          validationStatus: result.passed ? "PASSED" : "FAILED",
          validationNotes: result.notes.join("; ") || null,
        },
      });
      return res.status(201).json(boost);
    } catch (err: unknown) {
      if (err != null && typeof err === "object" && "code" in err) {
        const code = (err as { code: string }).code;
        if (code === "P2002") {
          return res.status(409).json({ error: "That message already exists." });
        }
        console.error(`Prisma error creating positivity boost (${code}):`, err);
        return res.status(500).json({ error: "Database error - please try again." });
      }
      console.error("Error creating positivity boost:", err);
      return res.status(500).json({ error: "An error occurred while creating the message. Please try again." });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}

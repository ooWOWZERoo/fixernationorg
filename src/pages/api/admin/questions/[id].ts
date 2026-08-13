import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { QuestionStatus } from "@prisma/client";

function isAdmin(role: string) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

const putSchema = z.object({
  status: z.nativeEnum(QuestionStatus),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !isAdmin(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method !== "PUT") {
    res.setHeader("Allow", "PUT");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query;
  if (typeof id !== "string") return res.status(400).json({ error: "Invalid id" });

  const parsed = putSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const { status } = parsed.data;

  const updated = await db.fixerQuestion.update({
    where: { id },
    data: {
      status,
      ...(status === "RESPONDED" ? { respondedAt: new Date() } : {}),
    },
  });

  return res.status(200).json(updated);
}

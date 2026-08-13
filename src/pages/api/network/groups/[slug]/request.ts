import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const body = z.object({ message: z.string().max(500).optional() });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Sign in to join groups." });

  const slug = req.query.slug as string;
  const group = await db.socialGroup.findUnique({ where: { slug } });
  if (!group) return res.status(404).json({ error: "Group not found." });

  const existing = await db.groupMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId: session.user.id } },
  });
  if (existing) return res.status(409).json({ error: "Already a member." });

  const existingRequest = await db.groupRequest.findUnique({
    where: { groupId_userId: { groupId: group.id, userId: session.user.id } },
  });
  if (existingRequest && existingRequest.status === "PENDING") {
    return res.status(409).json({ error: "Request already pending." });
  }

  const parsed = body.safeParse(req.body);
  const message = parsed.success ? (parsed.data.message ?? null) : null;

  if (existingRequest) {
    // Re-request after rejection
    await db.groupRequest.update({
      where: { id: existingRequest.id },
      data: { status: "PENDING", message, reviewedAt: null, reviewedBy: null },
    });
  } else {
    await db.groupRequest.create({
      data: { groupId: group.id, userId: session.user.id, message },
    });
  }

  return res.status(200).json({ ok: true });
}

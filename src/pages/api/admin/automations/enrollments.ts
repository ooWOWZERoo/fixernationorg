import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { journeyId, id: enrollmentId } = req.query as {
    journeyId?: string;
    id?: string;
  };

  if (req.method === "GET") {
    if (!journeyId) return res.status(400).json({ error: "Missing journeyId" });

    const journey = await db.automationJourney.findUnique({
      where: { id: journeyId },
      select: { _count: { select: { steps: true } } },
    });
    if (!journey) return res.status(404).json({ error: "Journey not found" });

    const enrollments = await db.automationEnrollment.findMany({
      where: { journeyId },
      orderBy: { enrolledAt: "desc" },
      take: 50,
    });

    const userIds = enrollments.map((e) => e.userId).filter(Boolean) as string[];
    const contactIds = enrollments.map((e) => e.contactId).filter(Boolean) as string[];

    const [users, contacts] = await Promise.all([
      userIds.length > 0
        ? db.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, email: true, name: true },
          })
        : [],
      contactIds.length > 0
        ? db.contact.findMany({
            where: { id: { in: contactIds } },
            select: { id: true, email: true, firstName: true, lastName: true },
          })
        : [],
    ]);

    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
    const contactMap = Object.fromEntries(contacts.map((c) => [c.id, c]));

    return res.status(200).json(
      enrollments.map((e) => ({
        ...e,
        totalSteps: journey._count.steps,
        enrolledAt: e.enrolledAt.toISOString(),
        completedAt: e.completedAt?.toISOString() ?? null,
        nextRunAt: e.nextRunAt?.toISOString() ?? null,
        user: e.userId ? (userMap[e.userId] ?? null) : null,
        contact: e.contactId ? (contactMap[e.contactId] ?? null) : null,
      }))
    );
  }

  if (req.method === "PATCH") {
    if (!enrollmentId) return res.status(400).json({ error: "Missing id" });
    const { status } = req.body as { status?: string };
    if (!status || !["PAUSED", "CANCELLED"].includes(status)) {
      return res.status(400).json({ error: "Status must be PAUSED or CANCELLED" });
    }
    const updated = await db.automationEnrollment.update({
      where: { id: enrollmentId },
      data: { status: status as "PAUSED" | "CANCELLED" },
    });
    return res.status(200).json(updated);
  }

  res.setHeader("Allow", "GET, PATCH");
  return res.status(405).json({ error: "Method not allowed" });
}

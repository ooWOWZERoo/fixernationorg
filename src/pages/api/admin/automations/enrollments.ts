import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import type { AutomationEnrollmentStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];
const STATUS_VALUES: AutomationEnrollmentStatus[] = ["ACTIVE", "COMPLETED", "PAUSED", "CANCELLED", "FAILED"];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { journeyId, id: enrollmentId, status: statusQuery } = req.query as {
    journeyId?: string;
    id?: string;
    status?: string;
  };

  if (req.method === "GET") {
    if (!journeyId) return res.status(400).json({ error: "Missing journeyId" });

    const journey = await db.automationJourney.findUnique({
      where: { id: journeyId },
      select: { _count: { select: { steps: true } } },
    });
    if (!journey) return res.status(404).json({ error: "Journey not found" });

    const statusFilter = STATUS_VALUES.find((s) => s === statusQuery);

    // Counts are always over the full journey, independent of the status
    // filter above — they drive the tab labels/badges, and (critically)
    // let a status like FAILED be filtered into view reliably even if it's
    // been pushed out of the plain "50 most recent" list by newer activity.
    const [enrollments, statusGroups] = await Promise.all([
      db.automationEnrollment.findMany({
        where: { journeyId, ...(statusFilter ? { status: statusFilter } : {}) },
        orderBy: { enrolledAt: "desc" },
        take: 50,
      }),
      db.automationEnrollment.groupBy({
        by: ["status"],
        where: { journeyId },
        _count: { id: true },
      }),
    ]);

    const counts: Record<string, number> = { ACTIVE: 0, COMPLETED: 0, PAUSED: 0, CANCELLED: 0, FAILED: 0 };
    for (const row of statusGroups) counts[row.status] = row._count.id;

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

    return res.status(200).json({
      counts,
      enrollments: enrollments.map((e) => ({
        ...e,
        totalSteps: journey._count.steps,
        enrolledAt: e.enrolledAt.toISOString(),
        completedAt: e.completedAt?.toISOString() ?? null,
        nextRunAt: e.nextRunAt?.toISOString() ?? null,
        user: e.userId ? (userMap[e.userId] ?? null) : null,
        contact: e.contactId ? (contactMap[e.contactId] ?? null) : null,
      })),
    });
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

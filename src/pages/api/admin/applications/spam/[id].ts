import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAction, getClientIp } from "@/lib/audit";
import { recordEvent } from "@/lib/application-events";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const bodySchema = z.object({
  blockEmail: z.boolean().default(true),
  reason: z.string().max(500).optional(),
});

// POST  → mark application as spam (optionally block the email)
// DELETE → unmark spam (does NOT unblock the email — use /api/admin/blocked-emails/[id] for that)
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { id } = req.query as { id: string };

  if (req.method === "POST") {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request" });
    }

    const application = await db.userApplication.findUnique({
      where: { id },
      select: { id: true, email: true, markedSpam: true },
    });
    if (!application) return res.status(404).json({ error: "Not found" });

    await db.userApplication.update({
      where: { id },
      data: { markedSpam: true, markedSpamAt: new Date() },
    });

    if (parsed.data.blockEmail) {
      await db.blockedEmail.upsert({
        where: { email: application.email },
        create: {
          email: application.email,
          reason: parsed.data.reason ?? "Marked as spam by admin",
          blockedBy: session.user.email ?? session.user.id,
        },
        update: {
          reason: parsed.data.reason ?? "Marked as spam by admin",
          blockedBy: session.user.email ?? session.user.id,
        },
      });
    }

    logAction({
      actorId: session.user.id,
      actorEmail: session.user.email,
      action: "application.marked_spam",
      resource: "UserApplication",
      resourceId: id,
      metadata: { email: application.email, blockEmail: parsed.data.blockEmail },
      ip: getClientIp(req),
    }).catch(console.error);

    recordEvent(id, "STATUS_CHANGED", session.user.email, {
      note: `Marked as spam${parsed.data.blockEmail ? " and email blocked" : ""}`,
    }).catch(console.error);

    return res.status(200).json({ markedSpam: true, emailBlocked: parsed.data.blockEmail });
  }

  if (req.method === "DELETE") {
    await db.userApplication.update({
      where: { id },
      data: { markedSpam: false, markedSpamAt: null },
    });

    logAction({
      actorId: session.user.id,
      actorEmail: session.user.email,
      action: "application.unmarked_spam",
      resource: "UserApplication",
      resourceId: id,
      metadata: {},
      ip: getClientIp(req),
    }).catch(console.error);

    return res.status(200).json({ markedSpam: false });
  }

  res.setHeader("Allow", "POST, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}

import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAction, getClientIp } from "@/lib/audit";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const KNOWN_KEYS = [
  "application.submitted",
  "application.under_review",
  "application.info_required",
  "application.conditionally_accepted",
  "application.accepted",
  "application.declined",
  "application.expired",
  "application.withdrawn",
  "application.expiration_reminder",
  "activation.welcome",
];

const putSchema = z.object({
  description: z.string().min(1).max(300).trim().optional(),
  subject:     z.string().min(1).max(300).trim(),
  body:        z.string().min(1).max(8000).trim(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { key } = req.query as { key: string };

  if (!KNOWN_KEYS.includes(key)) {
    return res.status(404).json({ error: "Unknown template key" });
  }

  if (req.method === "GET") {
    const tmpl = await db.messageTemplate.findUnique({ where: { key } });
    return res.status(200).json(tmpl ?? { key, notFound: true });
  }

  if (req.method === "PUT") {
    const parsed = putSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const existing = await db.messageTemplate.findUnique({ where: { key } });
    if (!existing) {
      return res.status(404).json({ error: "Template not seeded yet — run the SP-8 migration first." });
    }

    const updated = await db.messageTemplate.update({
      where: { key },
      data: {
        subject:     parsed.data.subject,
        body:        parsed.data.body,
        description: parsed.data.description ?? existing.description,
        updatedBy:   session.user.email ?? session.user.id,
      },
    });

    await logAction({
      actorId:    session.user.id,
      actorEmail: session.user.email,
      action:     "message_template.updated",
      resource:   "MessageTemplate",
      resourceId: key,
      metadata:   { subject: parsed.data.subject },
      ip:         getClientIp(req),
    });

    return res.status(200).json(updated);
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).json({ error: "Method not allowed" });
}

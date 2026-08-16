import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { blocksToHtml } from "@/lib/email-blocks";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  subject: z.string().min(1).max(200).optional(),
  htmlBody: z.string().optional(),
  textBody: z.string().optional().nullable(),
  blocks: z.array(z.record(z.unknown())).optional().nullable(),
  status: z.enum(["DRAFT", "APPROVED", "RETIRED"]).optional(),
  category: z.string().optional().nullable(),
  tags: z.string().optional().nullable(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || !ADMIN_ROLES.includes(session.user.role)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id } = req.query as { id: string };

  const template = await db.emailTemplate.findUnique({ where: { id } });
  if (!template) return res.status(404).json({ error: "Not found" });

  if (req.method === "GET") {
    return res.status(200).json(template);
  }

  if (req.method === "PUT") {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { blocks: rawBlocks, ...rest } = parsed.data;

    // If blocks provided, recompute htmlBody from them
    let derivedHtml: string | undefined;
    if (rawBlocks && rawBlocks.length > 0) {
      derivedHtml = blocksToHtml(rawBlocks as never);
    }

    const updated = await db.emailTemplate.update({
      where: { id },
      data: {
        ...rest,
        ...(rawBlocks !== undefined && { blocks: rawBlocks as never }),
        ...(derivedHtml !== undefined && !rest.htmlBody && { htmlBody: derivedHtml }),
      },
    });
    return res.status(200).json(updated);
  }

  if (req.method === "POST") {
    const { action } = req.body ?? {};

    if (action === "clone") {
      const cloned = await db.emailTemplate.create({
        data: {
          name: `Copy of ${template.name}`,
          subject: template.subject,
          htmlBody: template.htmlBody,
          textBody: template.textBody,
          blocks: template.blocks ?? undefined,
          category: template.category,
          tags: template.tags,
          status: "DRAFT",
          createdBy: session.user.id,
        },
      });
      return res.status(201).json(cloned);
    }

    if (action === "test_send") {
      const { to } = req.body;
      const recipient = to ?? session.user.email;
      if (!recipient) return res.status(400).json({ error: "No recipient email" });

      await sendEmail({
        to: recipient,
        subject: `[Test] ${template.subject}`,
        html: template.htmlBody,
        text: template.textBody ?? undefined,
      });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Unknown action" });
  }

  if (req.method === "DELETE") {
    await db.emailTemplate.delete({ where: { id } });
    return res.status(204).end();
  }

  res.setHeader("Allow", "GET, PUT, POST, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}

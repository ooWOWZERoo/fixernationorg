import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().optional(),
});

const addContactsSchema = z.object({
  contactIds: z.array(z.string()).min(1),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || !ADMIN_ROLES.includes(session.user.role)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id } = req.query as { id: string };

  const list = await db.contactList.findUnique({
    where: { id },
    include: { _count: { select: { members: true } } },
  });
  if (!list) return res.status(404).json({ error: "List not found" });

  if (req.method === "GET") {
    const members = await db.contactListMember.findMany({
      where: { listId: id },
      include: {
        contact: {
          select: { id: true, email: true, firstName: true, lastName: true, company: true },
        },
      },
      orderBy: { addedAt: "desc" },
    });
    return res.status(200).json({ ...list, members });
  }

  if (req.method === "PUT") {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const updated = await db.contactList.update({ where: { id }, data: parsed.data });
    return res.status(200).json(updated);
  }

  if (req.method === "DELETE") {
    await db.contactList.delete({ where: { id } });
    return res.status(204).end();
  }

  // POST to /api/admin/lists/[id]/contacts is handled by the [id]/contacts route
  // PATCH: bulk-add contacts
  if (req.method === "PATCH") {
    const { action } = req.body ?? {};
    if (action === "add-contacts") {
      const parsed = addContactsSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      await db.contactListMember.createMany({
        data: parsed.data.contactIds.map((contactId) => ({ listId: id, contactId })),
        skipDuplicates: true,
      });
      return res.status(200).json({ added: parsed.data.contactIds.length });
    }
    if (action === "remove-contact") {
      const { contactId } = req.body;
      if (!contactId) return res.status(400).json({ error: "contactId required" });
      await db.contactListMember.deleteMany({ where: { listId: id, contactId } });
      return res.status(204).end();
    }
    return res.status(400).json({ error: "Unknown action" });
  }

  res.setHeader("Allow", "GET, PUT, PATCH, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}

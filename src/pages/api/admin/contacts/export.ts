import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

function csvCell(value: string | null | undefined): string {
  const s = value ?? "";
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(cells: (string | null | undefined)[]): string {
  return cells.map(csvCell).join(",");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const contacts = await db.contact.findMany({
    select: {
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      company: true,
      source: true,
      createdAt: true,
      tags: { select: { tag: true } },
      listMemberships: { select: { list: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const header = csvRow([
    "email", "firstName", "lastName", "phone", "company",
    "source", "tags", "lists", "createdAt",
  ]);

  const rows = contacts.map((c) => {
    const tags = c.tags.map((t) => t.tag).join(";");
    const lists = c.listMemberships.map((m) => m.list.name).join(";");
    return csvRow([
      c.email,
      c.firstName,
      c.lastName,
      c.phone,
      c.company,
      c.source,
      tags || null,
      lists || null,
      c.createdAt.toISOString(),
    ]);
  });

  const csv = [header, ...rows].join("\r\n");
  const date = new Date().toISOString().slice(0, 10);

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="contacts-${date}.csv"`);
  return res.status(200).send(csv);
}

import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

type IdDb = {
  contactIdentity: {
    findUnique: (a: unknown) => Promise<{ id: string; contactId: string } | null>;
    delete: (a: unknown) => Promise<unknown>;
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || !ADMIN_ROLES.includes(session.user.role)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id, identityId } = req.query as { id: string; identityId: string };
  const idDb = db as never as IdDb;

  const identity = await idDb.contactIdentity.findUnique({ where: { id: identityId } as never });
  if (!identity) return res.status(404).json({ error: "Not found" });
  if (identity.contactId !== id) return res.status(403).json({ error: "Forbidden" });

  await idDb.contactIdentity.delete({ where: { id: identityId } as never });
  return res.status(204).end();
}

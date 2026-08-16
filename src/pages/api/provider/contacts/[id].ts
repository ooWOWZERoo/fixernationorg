import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const PROVIDER_ROLES = ["PROVIDER", "ADMIN", "SUPER_ADMIN"];

type ProviderContactDb = {
  providerContact: {
    findFirst: (a: unknown) => Promise<unknown | null>;
    delete: (a: unknown) => Promise<unknown>;
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || !PROVIDER_ROLES.includes(session.user.role)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id } = req.query;
  if (typeof id !== "string") return res.status(400).json({ error: "Invalid id" });

  const pdb = db as never as ProviderContactDb;

  const contact = await pdb.providerContact.findFirst({
    where: { id, providerUserId: session.user.id },
  });
  if (!contact) return res.status(404).json({ error: "Not found" });

  await pdb.providerContact.delete({ where: { id } });
  return res.status(200).json({ ok: true });
}

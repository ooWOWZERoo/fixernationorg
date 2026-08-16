import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

type ActDb = {
  contactActivity: {
    findMany: (a: unknown) => Promise<{
      id: string;
      type: string;
      summary: string;
      metadata: unknown;
      occurredAt: Date;
    }[]>;
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query as { id: string };
  const actDb = db as never as ActDb;

  const rows = await actDb.contactActivity.findMany({
    where: { contactId: id } as never,
    orderBy: { occurredAt: "desc" } as never,
    take: 100,
  });

  return res.status(200).json(
    rows.map((r) => ({
      id: r.id,
      type: r.type,
      summary: r.summary,
      metadata: r.metadata ?? null,
      occurredAt: r.occurredAt.toISOString(),
    }))
  );
}

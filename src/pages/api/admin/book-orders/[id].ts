import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// BookOrder is a new model the local Prisma client doesn't know about yet
// (regenerates on the next Vercel build) — cast at the call site per
// project convention.
type BookOrderDb = {
  bookOrder: {
    findUnique: (a: unknown) => Promise<{ id: string; status: string } | null>;
    update: (a: unknown) => Promise<unknown>;
  };
};

const schema = z.object({
  status: z.literal("SHIPPED"),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.adminRole || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id } = req.query as { id: string };
  const bookOrderDb = db as never as BookOrderDb;

  if (req.method === "PATCH") {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const order = await bookOrderDb.bookOrder.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.status !== "PAID") {
      return res.status(409).json({ error: "Only a paid order can be marked shipped." });
    }

    await bookOrderDb.bookOrder.update({
      where: { id },
      data: { status: "SHIPPED", shippedAt: new Date() },
    });
    return res.json({ ok: true });
  }

  res.setHeader("Allow", "PATCH");
  return res.status(405).json({ error: "Method not allowed" });
}

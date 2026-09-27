import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

// BookFormat is new — the local Prisma client only learns about it on the next
// Vercel build, so cast at the call site per project convention.
type BookFormatRow = {
  id: string;
  productId: string;
  format: string;
  amazonUrl: string | null;
  priceId: string | null;
  sortOrder: number;
};

type BookFormatDb = {
  bookFormat: {
    findUnique: (a: unknown) => Promise<BookFormatRow | null>;
    findFirst: (a: unknown) => Promise<BookFormatRow | null>;
    upsert: (a: unknown) => Promise<BookFormatRow>;
    delete: (a: unknown) => Promise<BookFormatRow>;
  };
};

const FORMAT_SORT: Record<string, number> = { PAPERBACK: 10, HARDCOVER: 20, DIGITAL: 30 };

const putSchema = z.object({
  format: z.enum(["PAPERBACK", "HARDCOVER", "DIGITAL"]),
  // Both keys are optional so the UI can save the Amazon link and attach a
  // price independently; an explicit null clears the stored value.
  amazonUrl: z.string().trim().url("Enter a full URL, starting with https://").or(z.literal("")).nullable().optional(),
  priceId: z.string().min(1).nullable().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { id } = req.query as { id: string };

  const product = await db.product.findUnique({ where: { id }, select: { id: true, type: true } });
  if (!product) return res.status(404).json({ error: "Product not found" });
  if (product.type !== "BOOK") {
    return res.status(400).json({ error: "Formats only apply to book products." });
  }

  const formatDb = db as never as BookFormatDb;

  if (req.method === "PUT") {
    const parsed = putSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
    }
    const { format } = parsed.data;
    const amazonUrl = parsed.data.amazonUrl === undefined ? undefined : parsed.data.amazonUrl || null;
    const priceId = parsed.data.priceId === undefined ? undefined : parsed.data.priceId;

    // Digital is Amazon-only. Nothing in this app can deliver an ebook, so a
    // price on a DIGITAL format would sell something we can't fulfil. The UI
    // hides the control; this is the server-side backstop.
    if (format === "DIGITAL" && priceId) {
      return res.status(400).json({
        error: "Kindle is an Amazon link only — it can't carry an in-site price.",
      });
    }

    if (priceId) {
      const price = await db.price.findUnique({
        where: { id: priceId },
        select: { id: true, productId: true, interval: true, active: true },
      });
      if (!price || price.productId !== id) {
        return res.status(400).json({ error: "That price doesn't belong to this book." });
      }
      if (price.interval !== "ONE_TIME") {
        return res.status(400).json({ error: "A book format needs a one-time price, not a recurring one." });
      }
      if (!price.active) {
        return res.status(400).json({ error: "That price is inactive. Activate it first, or add a new one." });
      }

      // priceId is unique on BookFormat — catch a double-attach with a clear
      // message instead of a Prisma constraint error.
      const alreadyUsed = await formatDb.bookFormat.findFirst({ where: { priceId } });
      if (alreadyUsed && alreadyUsed.format !== format) {
        return res.status(409).json({ error: `That price is already attached to the ${alreadyUsed.format} format.` });
      }
    }

    const row = await formatDb.bookFormat.upsert({
      where: { productId_format: { productId: id, format } },
      create: {
        productId: id,
        format,
        amazonUrl: amazonUrl ?? null,
        priceId: priceId ?? null,
        sortOrder: FORMAT_SORT[format] ?? 0,
      },
      update: {
        ...(amazonUrl === undefined ? {} : { amazonUrl }),
        ...(priceId === undefined ? {} : { priceId }),
      },
    });

    return res.status(200).json(row);
  }

  if (req.method === "DELETE") {
    const format = req.query.format as string;
    if (!format || !["PAPERBACK", "HARDCOVER", "DIGITAL"].includes(format)) {
      return res.status(400).json({ error: "format required" });
    }
    try {
      await formatDb.bookFormat.delete({ where: { productId_format: { productId: id, format } } });
      return res.status(204).end();
    } catch {
      return res.status(404).json({ error: "Format not found" });
    }
  }

  res.setHeader("Allow", "PUT, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}

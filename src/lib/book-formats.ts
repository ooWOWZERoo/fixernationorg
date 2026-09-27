import { db } from "@/lib/db";

export type BookFormatKind = "PAPERBACK" | "HARDCOVER" | "DIGITAL";

export const BOOK_FORMAT_LABEL: Record<BookFormatKind, string> = {
  PAPERBACK: "Paperback",
  HARDCOVER: "Hardcover",
  DIGITAL: "Kindle",
};

export interface RawBookFormat {
  id: string;
  productId: string;
  format: BookFormatKind;
  amazonUrl: string | null;
  priceId: string | null;
  sortOrder: number;
  price: {
    id: string;
    amount: number;
    active: boolean;
    interval: string;
    stripePriceId: string | null;
  } | null;
}

// BookFormat is new — the local Prisma client only learns about it on the next
// Vercel build, so the cast lives here and nothing else has to repeat it.
type BookFormatDb = {
  bookFormat: { findMany: (a: unknown) => Promise<RawBookFormat[]> };
};

export async function fetchBookFormats(productIds: string[]): Promise<RawBookFormat[]> {
  if (productIds.length === 0) return [];
  return (db as never as BookFormatDb).bookFormat.findMany({
    where: { productId: { in: productIds } },
    include: {
      price: { select: { id: true, amount: true, active: true, interval: true, stripePriceId: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { format: "asc" }],
  });
}

type BookFormatLookupDb = {
  bookFormat: { findFirst: (a: unknown) => Promise<{ format: BookFormatKind } | null> };
};

export async function findFormatForPrice(priceId: string): Promise<BookFormatKind | null> {
  const row = await (db as never as BookFormatLookupDb).bookFormat.findFirst({
    where: { priceId },
    select: { format: true },
  });
  return row?.format ?? null;
}

export interface PublicBookFormat {
  format: BookFormatKind;
  label: string;
  amazonUrl: string | null;
  priceId: string | null;
  amount: number | null;
}

// A format only shows up if it can actually be bought somewhere. An in-site
// price counts only when it is one-time, active, and already in Stripe, since
// checkout needs a stripePriceId. DIGITAL never gets a buy button, whatever
// the row says.
export function toPublicFormats(rows: RawBookFormat[]): PublicBookFormat[] {
  return rows
    .map((row) => {
      const price = row.price;
      const buyable =
        row.format !== "DIGITAL" &&
        !!price &&
        price.active &&
        price.interval === "ONE_TIME" &&
        !!price.stripePriceId;

      return {
        format: row.format,
        label: BOOK_FORMAT_LABEL[row.format] ?? row.format,
        amazonUrl: row.amazonUrl || null,
        priceId: buyable ? price!.id : null,
        amount: buyable ? price!.amount : null,
      };
    })
    .filter((f) => f.amazonUrl || f.priceId);
}

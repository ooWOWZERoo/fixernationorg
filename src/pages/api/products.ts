import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/lib/db";
import type { ProductType } from "@prisma/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }

  const { type } = req.query;

  const products = await db.product.findMany({
    where: {
      active: true,
      ...(type ? { type: type as ProductType } : {}),
    },
    include: {
      prices: {
        where: { active: true },
        orderBy: { interval: "asc" },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate");
  return res.status(200).json(products);
}

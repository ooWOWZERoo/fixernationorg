import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

type PushDb = {
  pushSubscription: {
    deleteMany: (a: unknown) => Promise<unknown>;
  };
};

const schema = z.object({
  endpoint: z.string().url(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const pushDb = db as never as PushDb;
  await pushDb.pushSubscription.deleteMany({
    where: {
      userId: session.user.id,
      endpoint: parsed.data.endpoint,
    } as never,
  } as never);

  return res.status(200).json({ ok: true });
}

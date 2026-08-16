import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

type PushDb = {
  pushSubscription: {
    upsert: (a: unknown) => Promise<unknown>;
  };
};

const schema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  userAgent: z.string().optional(),
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
  await pushDb.pushSubscription.upsert({
    where: {
      userId_endpoint: {
        userId: session.user.id,
        endpoint: parsed.data.endpoint,
      },
    } as never,
    create: {
      userId: session.user.id,
      endpoint: parsed.data.endpoint,
      p256dhKey: parsed.data.keys.p256dh,
      authKey: parsed.data.keys.auth,
      userAgent: parsed.data.userAgent ?? null,
    } as never,
    update: {
      p256dhKey: parsed.data.keys.p256dh,
      authKey: parsed.data.keys.auth,
    } as never,
  } as never);

  return res.status(200).json({ ok: true });
}

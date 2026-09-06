import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

const bodySchema = z.object({
  timezone: z.string().min(1).max(100),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" })

  if (req.method !== "PATCH") {
    res.setHeader("Allow", "PATCH")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const parsed = bodySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  // timezone is a new scalar field on User -- the local Prisma client type
  // doesn't know about it until Vercel regenerates the client on build.
  await db.user.update({
    where: { id: session.user.id },
    data: { timezone: parsed.data.timezone } as unknown as Parameters<typeof db.user.update>[0]["data"],
  })

  return res.json({ ok: true })
}

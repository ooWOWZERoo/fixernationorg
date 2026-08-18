import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

type ChallengesDb = {
  challenge: {
    findMany: (args?: Record<string, unknown>) => Promise<unknown[]>
    create: (args: Record<string, unknown>) => Promise<unknown>
    count: (args?: Record<string, unknown>) => Promise<number>
  }
}
const db_ = db as never as ChallengesDb

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"]

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  summary: z.string().min(1),
  focusAreaIds: z.array(z.string()).default([]),
  durationDays: z.number().int().positive().default(30),
  active: z.boolean().default(true),
  startMode: z.enum(["EVERGREEN", "SCHEDULED"]).default("EVERGREEN"),
  startDate: z.string().datetime().optional(),
  enrollmentLimit: z.number().int().positive().optional(),
  loyaltyPoints: z.number().int().min(0).default(0),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.adminRole || !ADMIN_ROLES.includes(session.user.adminRole))
    return res.status(401).json({ error: "Unauthorized" })

  if (req.method === "GET") {
    const challenges = await db_.challenge.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { steps: true, enrollments: true } } },
    })
    return res.json({ challenges })
  }

  if (req.method === "POST") {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const { title, ...rest } = parsed.data
    const baseSlug = slugify(title)
    const existing = await db_.challenge.findMany({ where: { slug: { startsWith: baseSlug } } }) as { slug: string }[]
    let slug = baseSlug
    if (existing.some((c) => c.slug === baseSlug)) {
      slug = `${baseSlug}-${existing.length}`
    }

    const challenge = await db_.challenge.create({
      data: { title, slug, ...rest },
    })
    return res.status(201).json(challenge)
  }

  res.setHeader("Allow", "GET, POST")
  return res.status(405).json({ error: "Method not allowed" })
}

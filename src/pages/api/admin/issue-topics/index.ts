import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

type IssueTopicRow = {
  id: string
  title: string
  slug: string
  description: string | null
  focusAreaId: string | null
  active: boolean
  order: number
  createdAt: Date
  updatedAt: Date
}

type IssueTopicsDb = {
  issueTopic: {
    findMany: (args?: Record<string, unknown>) => Promise<IssueTopicRow[]>
    create: (args: Record<string, unknown>) => Promise<IssueTopicRow>
    findFirst: (args: Record<string, unknown>) => Promise<IssueTopicRow | null>
  }
}

const db_ = db as never as IssueTopicsDb

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"]

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
}

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  focusAreaId: z.string().optional(),
  order: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.adminRole || !ADMIN_ROLES.includes(session.user.adminRole))
    return res.status(401).json({ error: "Unauthorized" })

  if (req.method === "GET") {
    const topics = await db_.issueTopic.findMany({ orderBy: { order: "asc" } })
    return res.json({ topics })
  }

  if (req.method === "POST") {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const { title, description, focusAreaId, order, active } = parsed.data

    const baseSlug = slugify(title)
    const existing = await db_.issueTopic.findMany({
      where: { slug: { startsWith: baseSlug } },
    } as Record<string, unknown>) as IssueTopicRow[]
    let slug = baseSlug
    if (existing.some((t) => t.slug === baseSlug)) {
      slug = `${baseSlug}-${existing.length}`
    }

    const topic = await db_.issueTopic.create({
      data: {
        title,
        slug,
        description: description ?? null,
        focusAreaId: focusAreaId ?? null,
        order,
        active,
      },
    })
    return res.status(201).json(topic)
  }

  res.setHeader("Allow", "GET, POST")
  return res.status(405).json({ error: "Method not allowed" })
}

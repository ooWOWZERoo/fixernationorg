import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

type FocusDb = {
  focusArea: {
    findMany: (args?: { where?: object; orderBy?: object }) => Promise<FocusAreaRow[]>
  }
  memberFocusArea: {
    findMany: (args?: { where?: object; include?: object }) => Promise<MemberFocusAreaRow[]>
    deleteMany: (args: { where: object }) => Promise<{ count: number }>
    createMany: (args: { data: object[] }) => Promise<{ count: number }>
  }
  memberPreference: {
    findUnique: (args: { where: object }) => Promise<MemberPreferenceRow | null>
    upsert: (args: { where: object; create: object; update: object }) => Promise<MemberPreferenceRow>
  }
}

type FocusAreaRow = {
  id: string
  name: string
  order: number
  active: boolean
}

type MemberFocusAreaRow = {
  id: string
  userId: string
  focusAreaId: string
  isPrimary: boolean
  createdAt: Date
  focusArea?: FocusAreaRow
}

type MemberPreferenceRow = {
  id: string
  userId: string
  contentDepth: string
  contentFormats: string[]
  reminderEnabled: boolean
  reminderTime: string | null
  createdAt: Date
  updatedAt: Date
}

const focusAreaSchema = z.object({
  focusAreaId: z.string().min(1),
  isPrimary: z.boolean(),
})

const saveSchema = z.object({
  focusAreas: z
    .array(focusAreaSchema)
    .max(3, "You can select at most 3 focus areas"),
  preferences: z.object({
    contentDepth: z.enum(["QUICK", "SHORT", "DEEPER"]),
    contentFormats: z.array(z.enum(["text", "audio", "video", "reflection", "challenge"])),
    reminderEnabled: z.boolean(),
    reminderTime: z.string().nullable().optional(),
  }),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  const userId = session.user.id
  const db_ = db as never as FocusDb

  if (req.method === "GET") {
    const [allAreas, myAreas, myPrefs] = await Promise.all([
      db_.focusArea.findMany({
        where: { active: true },
        orderBy: { order: "asc" },
      }),
      db_.memberFocusArea.findMany({
        where: { userId },
        include: { focusArea: true },
      }),
      db_.memberPreference.findUnique({ where: { userId } }),
    ])

    return res.json({
      allAreas: JSON.parse(JSON.stringify(allAreas)),
      myAreas: JSON.parse(JSON.stringify(myAreas)),
      preferences: myPrefs ? JSON.parse(JSON.stringify(myPrefs)) : null,
    })
  }

  if (req.method === "POST") {
    const parsed = saveSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const { focusAreas, preferences } = parsed.data

    // Enforce: at most one isPrimary
    const primaryCount = focusAreas.filter((f) => f.isPrimary).length
    if (focusAreas.length > 0 && primaryCount !== 1) {
      return res.status(400).json({ error: "Exactly one focus area must be marked as primary." })
    }

    // Replace focus areas: delete existing rows for this user, then insert fresh set
    await db_.memberFocusArea.deleteMany({ where: { userId } })

    if (focusAreas.length > 0) {
      await db_.memberFocusArea.createMany({
        data: focusAreas.map((f) => ({
          userId,
          focusAreaId: f.focusAreaId,
          isPrimary: f.isPrimary,
        })),
      })
    }

    const pref = await db_.memberPreference.upsert({
      where: { userId },
      create: {
        userId,
        contentDepth: preferences.contentDepth,
        contentFormats: preferences.contentFormats,
        reminderEnabled: preferences.reminderEnabled,
        reminderTime: preferences.reminderTime ?? null,
      },
      update: {
        contentDepth: preferences.contentDepth,
        contentFormats: preferences.contentFormats,
        reminderEnabled: preferences.reminderEnabled,
        reminderTime: preferences.reminderTime ?? null,
      },
    })

    return res.json({ ok: true, preferences: JSON.parse(JSON.stringify(pref)) })
  }

  res.setHeader("Allow", "GET, POST")
  return res.status(405).json({ error: "Method not allowed" })
}

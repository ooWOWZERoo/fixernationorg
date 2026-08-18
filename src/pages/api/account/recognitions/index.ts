import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { awardPoints } from "@/lib/loyalty"

type RecognitionRow = {
  id: string
  fromUserId: string
  toUserId: string
  message: string
  isPublic: boolean
  createdAt: Date
  fromUser?: { id: string; name: string | null; image: string | null } | null
}

type RecognitionDb = {
  memberRecognition: {
    findMany: (args?: Record<string, unknown>) => Promise<RecognitionRow[]>
    create: (args: { data: object }) => Promise<RecognitionRow>
  }
}

const db_ = db as never as RecognitionDb

const bodySchema = z.object({
  toUserId: z.string().min(1),
  message: z.string().min(10, "Message must be at least 10 characters"),
  isPublic: z.boolean().optional().default(true),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" })

  const fromUserId = session.user.id

  if (req.method === "GET") {
    const [received, given] = await Promise.all([
      db_.memberRecognition.findMany({
        where: { toUserId: fromUserId },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { fromUser: { select: { id: true, name: true, image: true } } },
      }),
      db_.memberRecognition.findMany({
        where: { fromUserId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ])

    return res.json({
      received: JSON.parse(JSON.stringify(received)),
      given: JSON.parse(JSON.stringify(given)),
    })
  }

  if (req.method === "POST") {
    const parsed = bodySchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const { toUserId, message, isPublic } = parsed.data

    if (toUserId === fromUserId) {
      return res.status(400).json({ error: "You cannot recognize yourself" })
    }

    // Verify the target user exists
    const toUser = await db.user.findUnique({ where: { id: toUserId } })
    if (!toUser) return res.status(404).json({ error: "User not found" })

    const recognition = await db_.memberRecognition.create({
      data: { fromUserId, toUserId, message, isPublic },
    })

    // Award 10 points to the sender, fire-and-forget
    awardPoints(fromUserId, 10, "RECOGNITION_GIVEN", recognition.id).catch(() => {})

    return res.status(201).json({ recognition: JSON.parse(JSON.stringify(recognition)) })
  }

  res.setHeader("Allow", "GET, POST")
  return res.status(405).json({ error: "Method not allowed" })
}

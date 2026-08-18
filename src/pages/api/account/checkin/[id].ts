import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

type CheckInRow = {
  id: string
  userId: string
  date: Date
}

type CheckInDb = {
  dailyCheckIn: {
    findUnique: (args: Record<string, unknown>) => Promise<CheckInRow | null>
    delete: (args: Record<string, unknown>) => Promise<unknown>
  }
}
const db_ = db as never as CheckInDb

function todayDateUTC(): Date {
  const d = new Date()
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" })

  const { id } = req.query
  if (!id || typeof id !== "string") return res.status(400).json({ error: "Missing id" })

  if (req.method === "DELETE") {
    const record = await db_.dailyCheckIn.findUnique({ where: { id } })
    if (!record) return res.status(404).json({ error: "Not found" })
    if (record.userId !== session.user.id) return res.status(403).json({ error: "Forbidden" })

    // Only allow deleting today's entry
    const today = todayDateUTC().getTime()
    const recordDay = new Date(record.date).getTime()
    if (recordDay !== today) return res.status(403).json({ error: "Can only remove today's check-in" })

    await db_.dailyCheckIn.delete({ where: { id } })
    return res.status(204).end()
  }

  res.setHeader("Allow", "DELETE")
  return res.status(405).json({ error: "Method not allowed" })
}

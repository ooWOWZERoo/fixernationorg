import { db } from "@/lib/db"

type ChallengeEnrollmentRow = {
  id: string
  status: string
  challenge: {
    id: string
    title: string
    slug: string
  }
}

type PathwayEnrollmentRow = {
  id: string
  status: string
  pathway: {
    id: string
    title: string
    slug: string
  }
}

type MemberFocusAreaRow = {
  focusAreaId: string
}

type IssueTopicRow = {
  id: string
  title: string
  slug: string
  focusAreaId: string | null
}

type ChallengeRow = {
  id: string
  title: string
  slug: string
  active: boolean
}

type RecommendationEngineDb = {
  challengeEnrollment: {
    findFirst: (args: Record<string, unknown>) => Promise<ChallengeEnrollmentRow | null>
  }
  pathwayEnrollment: {
    findFirst: (args: Record<string, unknown>) => Promise<PathwayEnrollmentRow | null>
  }
  memberFocusArea: {
    findMany: (args: Record<string, unknown>) => Promise<MemberFocusAreaRow[]>
  }
  issueTopic: {
    findFirst: (args: Record<string, unknown>) => Promise<IssueTopicRow | null>
  }
  challenge: {
    findFirst: (args: Record<string, unknown>) => Promise<ChallengeRow | null>
  }
}

const db_ = db as never as RecommendationEngineDb

export async function generateRecommendation(userId: string): Promise<{
  category: string
  resourceId: string
  resourceTitle: string
  resourceSlug?: string
  reason: string
} | null> {
  // 1. Active challenge enrollment
  const activeChallenge = await db_.challengeEnrollment.findFirst({
    where: { userId, status: "ACTIVE" },
    include: { challenge: { select: { id: true, title: true, slug: true } } },
  })
  if (activeChallenge) {
    return {
      category: "CHALLENGE",
      resourceId: activeChallenge.challenge.id,
      resourceTitle: activeChallenge.challenge.title,
      resourceSlug: activeChallenge.challenge.slug,
      reason: "Pick up where you left off in your active challenge",
    }
  }

  // 2. Active pathway enrollment
  const activePathway = await db_.pathwayEnrollment.findFirst({
    where: { userId, status: "ACTIVE" },
    include: { pathway: { select: { id: true, title: true, slug: true } } },
  })
  if (activePathway) {
    return {
      category: "PATHWAY",
      resourceId: activePathway.pathway.id,
      resourceTitle: activePathway.pathway.title,
      resourceSlug: activePathway.pathway.slug,
      reason: "Continue your active growth pathway",
    }
  }

  // 3. Issue topic matching a focus area
  const focusAreas = await db_.memberFocusArea.findMany({
    where: { userId },
    select: { focusAreaId: true },
  })
  if (focusAreas.length > 0) {
    const focusAreaIds = focusAreas.map((f) => f.focusAreaId)
    const topic = await db_.issueTopic.findFirst({
      where: { active: true, focusAreaId: { in: focusAreaIds } },
      orderBy: { order: "asc" },
    })
    if (topic) {
      return {
        category: "ISSUE",
        resourceId: topic.id,
        resourceTitle: topic.title,
        resourceSlug: topic.slug,
        reason: "Based on your focus areas",
      }
    }
  }

  // 4. Fallback: any active challenge
  const fallbackChallenge = await db_.challenge.findFirst({
    where: { active: true },
    orderBy: { createdAt: "desc" },
  })
  if (fallbackChallenge) {
    return {
      category: "CHALLENGE",
      resourceId: fallbackChallenge.id,
      resourceTitle: fallbackChallenge.title,
      resourceSlug: fallbackChallenge.slug,
      reason: "A challenge that members are finding valuable",
    }
  }

  return null
}

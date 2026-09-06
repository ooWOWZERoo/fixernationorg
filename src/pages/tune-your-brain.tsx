import type { NextPageWithLayout } from "@/types/next"
import type { GetServerSideProps } from "next"
import Head from "next/head"
import { useState, useEffect, useCallback } from "react"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { SiteLayout } from "@/components/layout/SiteLayout"
import { AccountNav } from "@/components/account/AccountNav"
import { TB_GAME_REGISTRY } from "@/lib/tuneBrain/registry"
import { BadgeFrame } from "@/components/tuneBrain/BadgeFrame"
import { getMemberCalendarDate } from "@/lib/tuneBrainDate"
import { DAILY_GOAL_KEY, WEEKLY_GOAL_KEY, PERSONAL_REFRAME_BUILDER_KEY, GOAL_LABELS, mondayOf } from "@/lib/tuneBrain/goals"

interface SessionOption {
  id: string
  label: string
}

interface SessionContentItem {
  id: string
  prompt: string
  difficulty: number | null
  category: string | null
  options: SessionOption[]
}

interface CompleteResult {
  wasCorrect: boolean
  explanation: string | null
}

interface BadgeVM {
  id: string
  key: string
  name: string
  description: string
  tier: string | null
  iconKey: string
}

interface EarnedBadgeVM extends BadgeVM {
  earnedAt: string
}

interface GoalVM {
  id: string
  period: string
  key: string
  target: number
  progress: number
  status: string
}

interface Props {
  hasTimezone: boolean
  earnedBadges: EarnedBadgeVM[]
  lockedBadges: BadgeVM[]
  goals: GoalVM[]
}

const GAME_KEY = "POSITIVE_REFRAME"

const TuneYourBrainPage: NextPageWithLayout<Props> = ({ hasTimezone, earnedBadges, lockedBadges, goals }) => {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [contentItem, setContentItem] = useState<SessionContentItem | null>(null)
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [result, setResult] = useState<CompleteResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startSession = useCallback(async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    setSelectedOptionId(null)
    setContentItem(null)
    try {
      const res = await fetch("/api/account/tune-your-brain/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameKey: GAME_KEY }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Couldn't load a scenario.")
      setSessionId(data.sessionId)
      setContentItem(data.contentItem)
    } catch {
      setError("Couldn't load that. Try again in a minute.")
    } finally {
      setLoading(false)
    }
  }, [])

  // Fire-and-forget, best-effort timezone capture -- never block rendering
  // on it, and only send it once (getServerSideProps already tells us if
  // the member has a stored timezone).
  useEffect(() => {
    if (hasTimezone) return
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (timezone) {
        fetch("/api/account/timezone", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timezone }),
        }).catch(() => {})
      }
    } catch {
      // Best-effort only.
    }
  }, [hasTimezone])

  useEffect(() => {
    startSession()
  }, [startSession])

  async function handleSelect(optionId: string) {
    if (!sessionId || submitting || result) return
    setSelectedOptionId(optionId)
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/account/tune-your-brain/sessions/${sessionId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Something went wrong")
      setResult({ wasCorrect: data.wasCorrect, explanation: data.explanation })
    } catch {
      setError("That didn't save. Try again.")
      setSelectedOptionId(null)
    } finally {
      setSubmitting(false)
    }
  }

  const gameDef = TB_GAME_REGISTRY[GAME_KEY]

  return (
    <>
      <Head>
        <title>Tune Your Brain — Fixer Nation</title>
      </Head>
      <section className="px-6 py-8 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <AccountNav />

          <div className="mb-2 flex items-center gap-2">
            <span className="text-2xl" aria-hidden="true">🧠</span>
            <h1 className="text-2xl font-extrabold text-navy">Tune Your Brain</h1>
          </div>
          <p className="text-sm text-ink-soft mb-6">
            A quick way to practice meeting everyday setbacks with a clear head instead of a harsh one.
          </p>

          {error && (
            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <div className="rounded-2xl border border-navy/8 bg-white p-6">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-amber-dark mb-3">
              {gameDef.label}
            </h2>

            {loading ? (
              <p className="text-sm text-ink-soft">Pulling up a scenario…</p>
            ) : contentItem ? (
              <>
                <p className="text-base font-semibold text-navy mb-5">{contentItem.prompt}</p>

                <div className="space-y-2">
                  {contentItem.options.map((opt) => {
                    const isSelected = selectedOptionId === opt.id
                    const showFeedback = !!result && isSelected
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={!!result || submitting}
                        onClick={() => handleSelect(opt.id)}
                        className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                          showFeedback
                            ? result?.wasCorrect
                              ? "border-green-400 bg-green-50"
                              : "border-amber bg-amber/10"
                            : isSelected
                              ? "border-amber bg-amber/10"
                              : "border-navy/10 hover:border-amber/50 hover:bg-cream-panel"
                        } ${result && !isSelected ? "opacity-50" : ""}`}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>

                {result && (
                  <div className="mt-5 rounded-xl bg-cream-panel border border-navy/8 p-4">
                    <p className="text-sm font-bold text-navy mb-1">
                      {result.wasCorrect ? "That's a solid reframe." : "Here's another way to look at it:"}
                    </p>
                    {result.explanation && (
                      <p className="text-sm text-ink-soft">{result.explanation}</p>
                    )}
                    <button
                      type="button"
                      onClick={startSession}
                      className="mt-4 rounded-xl bg-amber px-5 py-2 text-sm font-bold text-navy-dark hover:bg-amber-dark transition-colors"
                    >
                      Play again
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-ink-soft">
                Nothing to play right now. Check back soon.
              </p>
            )}
          </div>

          {/* My Goals */}
          <div className="mt-8 rounded-2xl border border-navy/8 bg-white p-6">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-amber-dark mb-4">My Goals</h2>
            {goals.length === 0 ? (
              <p className="text-sm text-ink-soft">Play a round to set your first goals.</p>
            ) : (
              <div className="space-y-3">
                {goals.map((goal) => {
                  const pct = Math.min(100, Math.round((goal.progress / goal.target) * 100))
                  const completed = goal.status === "COMPLETED"
                  return (
                    <div key={goal.id}>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-sm font-semibold text-navy">
                          {GOAL_LABELS[goal.key] ?? goal.key}
                        </span>
                        <span className={`text-xs font-bold ${completed ? "text-green-600" : "text-ink-soft"}`}>
                          {completed ? "Completed" : `${goal.progress}/${goal.target}`}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-cream-panel">
                        <div
                          className={`h-2 rounded-full ${completed ? "bg-green-500" : "bg-amber"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* My Badges */}
          <div className="mt-8 rounded-2xl border border-navy/8 bg-white p-6">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-amber-dark mb-4">My Badges</h2>
            {earnedBadges.length === 0 && lockedBadges.length === 0 ? (
              <p className="text-sm text-ink-soft">Badges will show up here as you play.</p>
            ) : (
              <div className="flex flex-wrap gap-4">
                {earnedBadges.map((badge) => (
                  <BadgeFrame key={badge.id} iconKey={badge.iconKey} name={badge.name} tier={badge.tier} state="earned" />
                ))}
                {lockedBadges.map((badge) => (
                  <BadgeFrame key={badge.id} iconKey={badge.iconKey} name={badge.name} tier={badge.tier} state="locked" />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  )
}

TuneYourBrainPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions)
  if (!session) return { redirect: { destination: "/signin?callbackUrl=/tune-your-brain", permanent: false } }

  const userId = session.user.id
  const user = await db.user.findUnique({ where: { id: userId } })
  const timezone = user?.timezone ?? null

  const today = getMemberCalendarDate(new Date(), timezone)
  const monday = mondayOf(today)

  const [earnedRows, allBadgeRows, goalRows] = await Promise.all([
    db.tbUserBadge.findMany({ where: { userId }, include: { badge: true }, orderBy: { earnedAt: "asc" } }),
    db.tbBadge.findMany({
      where: { isActive: true, OR: [{ gameKey: "POSITIVE_REFRAME" }, { gameKey: null }] },
      orderBy: { sortOrder: "asc" },
    }),
    db.tbGoal.findMany({
      where: {
        userId,
        OR: [
          { key: DAILY_GOAL_KEY, periodStart: today },
          { key: WEEKLY_GOAL_KEY, periodStart: monday },
          { key: PERSONAL_REFRAME_BUILDER_KEY },
        ],
      },
    }),
  ])

  const earnedBadgeIds = new Set(earnedRows.map((r) => r.badgeId))

  const earnedBadges = earnedRows.map((r) => ({
    id: r.badge.id,
    key: r.badge.key,
    name: r.badge.name,
    description: r.badge.description,
    tier: r.badge.tier,
    iconKey: r.badge.iconKey,
    earnedAt: r.earnedAt,
  }))

  const lockedBadges = allBadgeRows
    .filter((b) => !earnedBadgeIds.has(b.id))
    .map((b) => ({
      id: b.id,
      key: b.key,
      name: b.name,
      description: b.description,
      tier: b.tier,
      iconKey: b.iconKey,
    }))

  return {
    props: JSON.parse(
      JSON.stringify({
        hasTimezone: !!timezone,
        earnedBadges,
        lockedBadges,
        goals: goalRows,
      })
    ),
  }
}

export default TuneYourBrainPage

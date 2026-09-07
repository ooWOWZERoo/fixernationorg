import type { NextPageWithLayout } from "@/types/next"
import type { GetServerSideProps } from "next"
import Head from "next/head"
import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { SiteLayout } from "@/components/layout/SiteLayout"
import { AccountNav } from "@/components/account/AccountNav"
import { TB_GAME_REGISTRY } from "@/lib/tuneBrain/registry"
import { BadgeFrame } from "@/components/tuneBrain/BadgeFrame"
import { TimezoneCapture } from "@/components/tuneBrain/TimezoneCapture"
import { getMemberCalendarDate } from "@/lib/tuneBrainDate"
import { DAILY_GOAL_KEY, WEEKLY_GOAL_KEY, PERSONAL_REFRAME_BUILDER_KEY, GOAL_LABELS, mondayOf } from "@/lib/tuneBrain/goalConstants"

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

interface GameCardVM {
  gameKey: string
  tier: string | null
  currentStreak: number
}

interface Props {
  hasTimezone: boolean
  earnedBadges: EarnedBadgeVM[]
  lockedBadges: BadgeVM[]
  goals: GoalVM[]
  gameCards: GameCardVM[]
}

const TIER_LABELS: Record<string, string> = {
  STARTER: "Starter",
  EXPLORER: "Explorer",
  BUILDER: "Builder",
  CHALLENGER: "Challenger",
  SKILLED: "Skilled",
  ADVANCED: "Advanced",
  CHAMPION: "Champion",
}

const TuneYourBrainHubPage: NextPageWithLayout<Props> = ({ hasTimezone, earnedBadges, lockedBadges, goals, gameCards }) => {
  const cardByGameKey = new Map(gameCards.map((c) => [c.gameKey, c]))

  return (
    <>
      <Head>
        <title>Tune Your Brain — Fixer Nation</title>
      </Head>
      <TimezoneCapture hasTimezone={hasTimezone} />
      <section className="px-6 py-8 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <AccountNav />

          <div className="mb-2 flex items-center gap-2">
            <span className="text-2xl" aria-hidden="true">🧠</span>
            <h1 className="text-2xl font-extrabold text-navy">Tune Your Brain</h1>
          </div>
          <p className="text-sm text-ink-soft mb-6">
            A handful of quick games to help you practice a steadier, more positive way of meeting the day.
          </p>

          {/* Game picker */}
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.values(TB_GAME_REGISTRY).map((game) => {
              const card = cardByGameKey.get(game.key)
              return (
                <Link
                  key={game.key}
                  href={`/tune-your-brain/${game.routeSlug}`}
                  className="rounded-2xl border border-navy/8 bg-white p-5 no-underline transition-colors hover:border-amber/50 hover:bg-cream-panel"
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="text-xl" aria-hidden="true">{game.emoji}</span>
                    <span className="text-base font-bold text-navy">{game.label}</span>
                  </div>
                  <p className="text-sm text-ink-soft mb-2">{game.shortDescription}</p>
                  <div className="flex items-center gap-3 text-xs font-semibold text-amber-dark">
                    {card?.tier && <span>{TIER_LABELS[card.tier] ?? card.tier}</span>}
                    {!!card?.currentStreak && card.currentStreak > 1 && <span>🔥 {card.currentStreak}-day streak</span>}
                  </div>
                </Link>
              )
            })}
          </div>

          {/* My Goals */}
          <div className="mt-8 rounded-2xl border border-navy/8 bg-white p-6">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-amber-dark mb-4">My Goals</h2>
            {goals.length === 0 ? (
              <p className="text-sm text-ink-soft">Play a round of any game to set your first goals.</p>
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

TuneYourBrainHubPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions)
  if (!session) return { redirect: { destination: "/signin?callbackUrl=/tune-your-brain", permanent: false } }

  const userId = session.user.id
  const user = await db.user.findUnique({ where: { id: userId } })
  const timezone = user?.timezone ?? null

  const today = getMemberCalendarDate(new Date(), timezone)
  const monday = mondayOf(today)

  const [earnedRows, allBadgeRows, goalRows, levelRows, streakRows] = await Promise.all([
    db.tbUserBadge.findMany({ where: { userId }, include: { badge: true }, orderBy: { earnedAt: "asc" } }),
    // The hub shows badges across every game (not just one), so this is a
    // plain "every active badge" query -- no gameKey filter.
    db.tbBadge.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
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
    db.tbGameLevel.findMany({ where: { userId } }),
    db.streak.findMany({ where: { userId } }),
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

  const levelByGame = new Map(levelRows.map((l) => [l.gameKey as string, l]))
  const streakByGame = new Map(streakRows.map((s) => [s.scope, s]))

  const gameCards = Object.keys(TB_GAME_REGISTRY).map((gameKey) => ({
    gameKey,
    tier: levelByGame.get(gameKey)?.tier ?? null,
    currentStreak: streakByGame.get(gameKey)?.current ?? 0,
  }))

  return {
    props: JSON.parse(
      JSON.stringify({
        hasTimezone: !!timezone,
        earnedBadges,
        lockedBadges,
        goals: goalRows,
        gameCards,
      })
    ),
  }
}

export default TuneYourBrainHubPage

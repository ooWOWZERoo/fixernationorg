import type { NextPageWithLayout } from "@/types/next"
import type { GetServerSideProps } from "next"
import Head from "next/head"
import Link from "next/link"
import { useState, useEffect } from "react"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { SiteLayout } from "@/components/layout/SiteLayout"
import { AccountNav } from "@/components/account/AccountNav"

interface Milestone {
  id: string
  type: string
  title: string
  description: string | null
  awardedAt: string
}

interface Recognition {
  id: string
  message: string
  createdAt: string
  isPublic: boolean
  fromUser?: { id: string; name: string | null; image: string | null }
}

interface TybGameRow {
  gameKey: string
  label: string
  emoji: string
  tier: string
}

interface ProgressSummary {
  totalPoints: number
  milestonesCount: number
  recentMilestones: Milestone[]
  activePathways: number
  activeChallenges: number
  streak: number
  recognitionsCount: number
  tybTotalPoints: number
  tybGlobalStreak: number
  tybLongestStreak: number
  tybBadgesCount: number
  tybGamesPlayed: number
  tybGamesTotal: number
  tybGames: TybGameRow[]
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

// Level indicator = rank among the 7 tiers (1-7), never a raw score --
// keeps this a game-progress indicator, not anything reading as an
// IQ/cognitive-ability measure.
const TIER_ORDER = ["STARTER", "EXPLORER", "BUILDER", "CHALLENGER", "SKILLED", "ADVANCED", "CHAMPION"]

interface Props {
  userId: string
}

const MILESTONE_ICONS: Record<string, string> = {
  CHALLENGE_COMPLETED: "🏆",
  STREAK_7: "🔥",
  STREAK_30: "🔥🔥",
  PATHWAY_COMPLETED: "🎯",
  CHECKIN_10: "✅",
  CHECKIN_30: "⭐",
}

function milestoneIcon(type: string): string {
  return MILESTONE_ICONS[type] ?? "🌟"
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-navy/8 bg-white p-5 text-center">
      <p className="text-2xl font-extrabold text-navy">{value}</p>
      <p className="mt-1 text-xs font-semibold text-ink-soft uppercase tracking-wide">{label}</p>
    </div>
  )
}

const ProgressPage: NextPageWithLayout<Props> = () => {
  const [summary, setSummary] = useState<ProgressSummary | null>(null)
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [recognitions, setRecognitions] = useState<Recognition[]>([])
  const [loading, setLoading] = useState(true)

  // Recognition form state
  const [toUserId, setToUserId] = useState("")
  const [message, setMessage] = useState("")
  const [sendingRec, setSendingRec] = useState(false)
  const [recToast, setRecToast] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    async function load() {
      const [summaryRes, milestonesRes, recognitionsRes] = await Promise.all([
        fetch("/api/account/progress"),
        fetch("/api/account/milestones"),
        fetch("/api/account/recognitions"),
      ])
      const summaryData = await summaryRes.json()
      const milestonesData = await milestonesRes.json()
      const recognitionsData = await recognitionsRes.json()

      setSummary(summaryData)
      setMilestones(milestonesData.milestones ?? [])
      setRecognitions(recognitionsData.received ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function handleSendRecognition(e: React.FormEvent) {
    e.preventDefault()
    setSendingRec(true)
    setRecToast(null)
    try {
      const res = await fetch("/api/account/recognitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId, message }),
      })
      const data = await res.json()
      if (!res.ok) {
        const errMsg =
          typeof data.error === "string" ? data.error : "Couldn't send — give it another try."
        setRecToast({ ok: false, text: errMsg })
      } else {
        setToUserId("")
        setMessage("")
        setRecToast({ ok: true, text: "Recognition sent — you earned 10 points!" })
        // Refresh recognitions count in summary
        const freshSummary = await fetch("/api/account/progress")
        const freshData = await freshSummary.json()
        setSummary(freshData)
      }
    } catch {
      setRecToast({ ok: false, text: "Couldn't send — give it another try." })
    } finally {
      setSendingRec(false)
      setTimeout(() => setRecToast(null), 4000)
    }
  }

  return (
    <>
      <Head><title>My Progress — Fixer Nation</title></Head>
      <section className="px-6 py-8 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <AccountNav />

        <div className="mt-6">
          <h1 className="text-2xl font-extrabold text-navy mb-1">My Progress</h1>
          <p className="text-sm text-ink-soft mb-6">
            A running snapshot of where you stand — points, milestones, and the people who have your back.
          </p>

          {loading ? (
            <div className="rounded-2xl border border-navy/8 bg-white p-10 text-center text-sm text-ink-soft">
              Loading your progress...
            </div>
          ) : (
            <>
              {/* Stats row */}
              {summary && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 mb-8">
                  <StatCard label="Community points" value={summary.totalPoints.toLocaleString()} />
                  <StatCard label="Milestones earned" value={summary.milestonesCount} />
                  <StatCard label="Check-in streak" value={summary.streak > 0 ? `🔥 ${summary.streak}d` : "—"} />
                  <StatCard label="Active pathways" value={summary.activePathways} />
                  <StatCard label="Active challenges" value={summary.activeChallenges} />
                  <StatCard label="Recognitions received" value={summary.recognitionsCount} />
                  <StatCard label="Brain Builder points" value={summary.tybTotalPoints.toLocaleString()} />
                  <StatCard label="Brain Builder streak" value={summary.tybGlobalStreak > 0 ? `🔥 ${summary.tybGlobalStreak}d` : "—"} />
                  <StatCard label="Badges earned" value={summary.tybBadgesCount} />
                  <StatCard label="Games played" value={`${summary.tybGamesPlayed}/${summary.tybGamesTotal}`} />
                </div>
              )}

              {/* Tune Your Brain Progress */}
              {summary && (
                <div className="mb-8">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-navy">Brain Builder Progress</h2>
                    <Link href="/tune-your-brain" className="text-sm font-semibold text-amber hover:underline">
                      View all →
                    </Link>
                  </div>
                  <div className="rounded-2xl border border-navy/8 bg-white p-5">
                    <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                      Brain Builder Progress: {summary.tybGamesPlayed} of {summary.tybGamesTotal} games explored
                      {summary.tybLongestStreak > 0 && ` · Longest streak: 🔥 ${summary.tybLongestStreak}d`}
                    </p>
                    {summary.tybGames.length === 0 ? (
                      <p className="text-sm text-ink-soft">
                        Play a round of any Brain Builder game to start tracking progress here.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {summary.tybGames.map((g) => {
                          const rank = TIER_ORDER.indexOf(g.tier) + 1
                          return (
                            <div key={g.gameKey} className="flex items-center justify-between rounded-xl bg-cream-panel px-3 py-2">
                              <span className="flex items-center gap-2 text-sm font-semibold text-navy">
                                <span aria-hidden="true">{g.emoji}</span>
                                {g.label}
                              </span>
                              <span className="flex items-center gap-2 text-xs font-semibold text-ink-soft">
                                <span className="rounded-full bg-navy/6 px-2 py-0.5 text-navy">
                                  {TIER_LABELS[g.tier] ?? g.tier}
                                </span>
                                <span>Level {rank}/7</span>
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Milestones */}
              <div className="mb-8">
                <h2 className="text-lg font-bold text-navy mb-3">Milestones</h2>
                {milestones.length === 0 ? (
                  <div className="rounded-2xl border border-navy/8 bg-white p-6 text-sm text-ink-soft text-center">
                    No milestones yet — complete challenges, hit streaks, and finish pathways to earn them.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {milestones.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-start gap-4 rounded-2xl border border-navy/8 bg-white p-4"
                      >
                        <span className="text-2xl leading-none mt-0.5">{milestoneIcon(m.type)}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-navy leading-snug">{m.title}</p>
                          {m.description && (
                            <p className="mt-0.5 text-xs text-ink-soft">{m.description}</p>
                          )}
                          <p className="mt-1 text-xs text-ink-soft/70">
                            {new Date(m.awardedAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recognitions received */}
              <div className="mb-8">
                <h2 className="text-lg font-bold text-navy mb-3">Recognitions received</h2>
                {recognitions.length === 0 ? (
                  <div className="rounded-2xl border border-navy/8 bg-white p-6 text-sm text-ink-soft text-center">
                    Nothing here yet — but someone might be about to change that.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recognitions.map((r) => (
                      <div
                        key={r.id}
                        className="rounded-2xl border border-navy/8 bg-white p-4"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-8 w-8 rounded-full bg-amber/20 flex items-center justify-center text-sm font-bold text-navy">
                            {r.fromUser?.name?.[0]?.toUpperCase() ?? "?"}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-navy">
                              {r.fromUser?.name ?? "A member"}
                            </p>
                            <p className="text-xs text-ink-soft">
                              {new Date(r.createdAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm text-ink leading-relaxed">{r.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Send recognition form */}
              <div className="mb-8">
                <h2 className="text-lg font-bold text-navy mb-1">Give someone a shout-out</h2>
                <p className="text-sm text-ink-soft mb-4">
                  Seen a fellow member putting in the work? Let them know. You earn 10 points for every recognition you send.
                </p>

                {recToast && (
                  <div
                    className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium ${
                      recToast.ok
                        ? "bg-green-50 border border-green-200 text-green-800"
                        : "bg-red-50 border border-red-200 text-red-800"
                    }`}
                  >
                    {recToast.text}
                  </div>
                )}

                <form
                  onSubmit={handleSendRecognition}
                  className="rounded-2xl border border-navy/8 bg-white p-5 space-y-4"
                >
                  <div>
                    <label className="block text-sm font-bold text-navy mb-1.5">
                      Member ID
                    </label>
                    <input
                      type="text"
                      value={toUserId}
                      onChange={(e) => setToUserId(e.target.value)}
                      placeholder="Paste the member's user ID"
                      required
                      className="w-full rounded-xl border border-navy/15 bg-white px-4 py-2.5 text-sm text-ink placeholder-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-amber/40"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-navy mb-1.5">
                      Your message
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={3}
                      minLength={10}
                      maxLength={1000}
                      placeholder="Tell them what they did and why it matters..."
                      required
                      className="w-full rounded-xl border border-navy/15 bg-white px-4 py-3 text-sm text-ink placeholder-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-amber/40 resize-none"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={sendingRec}
                      className="rounded-xl bg-amber px-6 py-2.5 text-sm font-bold text-navy-dark hover:bg-amber-dark disabled:opacity-60 transition-colors"
                    >
                      {sendingRec ? "Sending..." : "Send recognition"}
                    </button>
                  </div>
                </form>
              </div>

              <div className="text-center">
                <Link href="/account" className="text-sm font-semibold text-amber hover:underline">
                  ← Back to account
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
      </section>
    </>
  )
}

ProgressPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions)
  if (!session) return { redirect: { destination: "/signin?callbackUrl=/account/progress", permanent: false } }

  return { props: { userId: session.user.id } }
}

export default ProgressPage

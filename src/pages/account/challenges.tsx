import type { NextPageWithLayout } from "@/types/next"
import type { GetServerSideProps } from "next"
import Head from "next/head"
import Link from "next/link"
import { useState } from "react"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { SiteLayout } from "@/components/layout/SiteLayout"
import { AccountNav } from "@/components/account/AccountNav"

type ChallengesDb = {
  challengeEnrollment: {
    findMany: (args?: any) => Promise<any[]>
  }
}

interface CompletionItem {
  stepId: string
}

interface EnrollmentRow {
  id: string
  status: string
  currentDay: number
  startedAt: string
  completedAt: string | null
  challenge: {
    id: string
    title: string
    slug: string
    summary: string
    durationDays: number
    stepCount: number
    loyaltyPoints: number
  }
  completedSteps: number
}

interface Props {
  enrollments: EnrollmentRow[]
}

const MyChallengesPage: NextPageWithLayout<Props> = ({ enrollments: initialEnrollments }) => {
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>(initialEnrollments)

  function handleAbandon(id: string) {
    setEnrollments((prev) => prev.filter((e) => e.id !== id))
  }

  const active = enrollments.filter((e) => e.status === "ACTIVE" || e.status === "PAUSED")
  const completed = enrollments.filter((e) => e.status === "COMPLETED")

  return (
    <>
      <Head><title>My Challenges — Fixer Nation</title></Head>
      <section className="px-6 py-8 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <AccountNav />
        <div className="mt-6">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-extrabold text-navy">My Challenges</h1>
            <Link
              href="/challenges"
              className="rounded-xl border border-navy/15 px-4 py-2 text-sm font-bold text-ink-soft no-underline hover:bg-cream-panel"
            >
              Browse challenges
            </Link>
          </div>

          {enrollments.length === 0 ? (
            <div className="rounded-2xl border border-navy/8 bg-white p-12 text-center">
              <p className="text-sm text-ink-soft">You have not joined any challenges yet.</p>
              <Link
                href="/challenges"
                className="mt-4 inline-block rounded-xl bg-amber px-5 py-2.5 text-sm font-bold text-navy-dark no-underline hover:bg-amber-dark"
              >
                Explore challenges
              </Link>
            </div>
          ) : (
            <>
              {active.length > 0 && (
                <div className="mb-8">
                  <h2 className="mb-3 text-base font-bold text-navy">In progress</h2>
                  <div className="space-y-3">
                    {active.map((e) => (
                      <ChallengeCard key={e.id} enrollment={e} onAbandon={handleAbandon} />
                    ))}
                  </div>
                </div>
              )}

              {completed.length > 0 && (
                <div>
                  <h2 className="mb-3 text-base font-bold text-navy">Completed</h2>
                  <div className="space-y-3">
                    {completed.map((e) => (
                      <ChallengeCard key={e.id} enrollment={e} onAbandon={handleAbandon} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      </section>
    </>
  )
}

function ChallengeCard({ enrollment, onAbandon }: { enrollment: EnrollmentRow; onAbandon: (id: string) => void }) {
  const [abandoning, setAbandoning] = useState(false)

  const pct = enrollment.challenge.stepCount > 0
    ? Math.round((enrollment.completedSteps / enrollment.challenge.stepCount) * 100)
    : 0

  async function handleAbandon() {
    if (!window.confirm(`Abandon "${enrollment.challenge.title}"? Your progress will be lost.`)) return
    setAbandoning(true)
    const res = await fetch(`/api/account/challenges/${enrollment.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "WITHDRAWN" }),
    })
    if (res.ok) {
      onAbandon(enrollment.id)
    } else {
      setAbandoning(false)
    }
  }

  return (
    <div className="rounded-2xl border border-navy/8 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/challenges/${enrollment.challenge.slug}`}
              className="font-semibold text-navy hover:underline no-underline"
            >
              {enrollment.challenge.title}
            </Link>
            {enrollment.status === "COMPLETED" && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                Completed
              </span>
            )}
            {enrollment.status === "PAUSED" && (
              <span className="rounded-full bg-amber/20 px-2 py-0.5 text-xs font-semibold text-amber-dark">
                Paused
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-ink-soft">{enrollment.challenge.summary}</p>
        </div>
        <div className="shrink-0 text-right">
          <span className="text-sm font-bold text-navy">{pct}%</span>
          <p className="text-xs text-ink-soft">
            {enrollment.completedSteps} / {enrollment.challenge.stepCount} steps
          </p>
        </div>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-navy/8">
        <div
          className="h-2 rounded-full bg-amber transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-ink-soft">
        <span>Day {enrollment.currentDay} of {enrollment.challenge.durationDays}</span>
        {enrollment.completedAt && enrollment.status === "COMPLETED" && (
          <span>Finished {new Date(enrollment.completedAt).toLocaleDateString()}</span>
        )}
        <div className="flex items-center gap-3">
          {enrollment.status === "ACTIVE" && (
            <Link
              href={`/challenges/${enrollment.challenge.slug}`}
              className="font-semibold text-navy hover:underline no-underline"
            >
              Continue →
            </Link>
          )}
          {(enrollment.status === "ACTIVE" || enrollment.status === "PAUSED") && (
            <button
              onClick={handleAbandon}
              disabled={abandoning}
              className="text-ink-soft hover:text-red-600 transition-colors disabled:opacity-50"
            >
              {abandoning ? "Abandoning…" : "Abandon"}
            </button>
          )}
        </div>
      </div>

      {enrollment.challenge.loyaltyPoints > 0 && enrollment.status !== "COMPLETED" && (
        <p className="mt-2 text-xs text-amber-dark font-medium">
          +{enrollment.challenge.loyaltyPoints} pts on completion
        </p>
      )}
    </div>
  )
}

MyChallengesPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions)
  if (!session) return { redirect: { destination: "/signin?callbackUrl=/account/challenges", permanent: false } }

  const db_ = db as never as ChallengesDb
  const enrollments = await db_.challengeEnrollment.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      challenge: { include: { _count: { select: { steps: true } } } },
      completions: { select: { stepId: true } },
    },
  }) as any[]

  return {
    props: {
      enrollments: enrollments.map((e) => ({
        id: e.id,
        status: e.status,
        currentDay: e.currentDay,
        startedAt: e.startedAt.toISOString(),
        completedAt: e.completedAt ? e.completedAt.toISOString() : null,
        challenge: {
          id: e.challenge.id,
          title: e.challenge.title,
          slug: e.challenge.slug,
          summary: e.challenge.summary,
          durationDays: e.challenge.durationDays,
          stepCount: e.challenge._count.steps,
          loyaltyPoints: e.challenge.loyaltyPoints,
        },
        completedSteps: (e.completions as CompletionItem[]).length,
      })),
    },
  }
}

export default MyChallengesPage

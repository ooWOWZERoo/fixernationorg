import type { NextPageWithLayout } from "@/types/next"
import type { GetServerSideProps } from "next"
import Head from "next/head"
import Link from "next/link"
import { useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/router"
import { db } from "@/lib/db"
import { SiteLayout } from "@/components/layout/SiteLayout"

type ChallengesDb = {
  challenge: {
    findUnique: (args: any) => Promise<any | null>
  }
  challengeEnrollment: {
    findFirst: (args: any) => Promise<any | null>
  }
}

interface ChallengeStep {
  id: string
  day: number
  title: string
  description: string | null
  actionPrompt: string | null
  reflectionPrompt: string | null
  order: number
}

interface Challenge {
  id: string
  title: string
  slug: string
  description: string
  summary: string
  durationDays: number
  focusAreaIds: string[]
  startMode: string
  loyaltyPoints: number
  steps: ChallengeStep[]
}

interface Props {
  challenge: Challenge
  enrollmentId: string | null
}

const ChallengeDetailPage: NextPageWithLayout<Props> = ({ challenge, enrollmentId: initialEnrollmentId }) => {
  const { data: session } = useSession()
  const router = useRouter()
  const [enrolling, setEnrolling] = useState(false)
  const [enrollmentId, setEnrollmentId] = useState<string | null>(initialEnrollmentId)
  const [enrollError, setEnrollError] = useState<string | null>(null)

  // Group steps by day
  const stepsByDay = challenge.steps.reduce<Record<number, ChallengeStep[]>>((acc, step) => {
    if (!acc[step.day]) acc[step.day] = []
    acc[step.day].push(step)
    return acc
  }, {})
  const days = Object.keys(stepsByDay).map(Number).sort((a, b) => a - b)

  async function handleEnroll() {
    if (!session) {
      router.push(`/signin?callbackUrl=/challenges/${challenge.slug}`)
      return
    }
    setEnrolling(true)
    setEnrollError(null)
    try {
      const res = await fetch("/api/account/challenges/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: challenge.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409) {
          setEnrollmentId(data.enrollmentId ?? "existing")
          return
        }
        setEnrollError(data.error ?? "Failed to join.")
        return
      }
      setEnrollmentId(data.id)
    } catch {
      setEnrollError("Network error.")
    } finally {
      setEnrolling(false)
    }
  }

  return (
    <>
      <Head><title>{challenge.title} — Fixer Nation</title></Head>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href="/challenges" className="text-sm text-ink-soft hover:text-navy no-underline">
            ← All challenges
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-navy">{challenge.title}</h1>
          <p className="mt-3 text-base text-ink-soft">{challenge.summary}</p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm text-ink-soft">
            <span className="rounded-full bg-navy/8 px-3 py-1 font-medium">
              {challenge.durationDays} days
            </span>
            <span className="rounded-full bg-navy/8 px-3 py-1 font-medium">
              {challenge.steps.length} step{challenge.steps.length !== 1 ? "s" : ""}
            </span>
            {challenge.loyaltyPoints > 0 && (
              <span className="rounded-full bg-amber/15 px-3 py-1 font-medium text-amber-dark">
                +{challenge.loyaltyPoints} pts on completion
              </span>
            )}
            {challenge.startMode === "EVERGREEN" && (
              <span className="rounded-full bg-green-50 px-3 py-1 font-medium text-green-700">
                Join any time
              </span>
            )}
          </div>
        </div>

        <div className="mb-8 rounded-2xl border border-navy/8 bg-white p-6">
          <p className="text-sm text-ink leading-relaxed">{challenge.description}</p>
        </div>

        {/* Enroll CTA */}
        <div className="mb-10">
          {enrollmentId ? (
            <div className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 px-5 py-4">
              <span className="text-sm font-semibold text-green-800">You are taking this challenge.</span>
              <Link href="/account/challenges" className="ml-auto text-sm font-bold text-green-700 hover:underline no-underline">
                View my progress →
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl border border-navy/8 bg-white px-5 py-4 flex items-center justify-between gap-4">
              <p className="text-sm text-ink-soft">Ready to commit? Join this challenge and track your daily progress.</p>
              <button
                onClick={handleEnroll}
                disabled={enrolling}
                className="shrink-0 rounded-xl bg-amber px-5 py-2.5 text-sm font-bold text-navy-dark hover:bg-amber-dark disabled:opacity-50"
              >
                {enrolling ? "Joining…" : session ? "Join challenge" : "Sign in to join"}
              </button>
            </div>
          )}
          {enrollError && (
            <p className="mt-2 text-sm text-red-600">{enrollError}</p>
          )}
        </div>

        {/* Steps by day */}
        <h2 className="mb-4 text-lg font-bold text-navy">What you will do</h2>
        <div className="space-y-6">
          {days.map((day) => (
            <div key={day}>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Day {day}</h3>
              <div className="space-y-3">
                {stepsByDay[day].map((step) => (
                  <div key={step.id} className="rounded-2xl border border-navy/8 bg-white p-4">
                    <p className="font-semibold text-navy text-sm">{step.title}</p>
                    {step.actionPrompt && (
                      <p className="mt-1.5 text-sm text-ink-soft">{step.actionPrompt}</p>
                    )}
                    {step.reflectionPrompt && (
                      <p className="mt-1 text-xs italic text-ink-soft/70">{step.reflectionPrompt}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

ChallengeDetailPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const { getServerSession } = await import("next-auth")
  const { authOptions } = await import("@/lib/auth")

  const session = await getServerSession(ctx.req, ctx.res, authOptions)
  const slug = ctx.params?.slug as string

  const db_ = db as never as ChallengesDb
  const challenge = await db_.challenge.findUnique({
    where: { slug },
    include: { steps: { orderBy: [{ day: "asc" }, { order: "asc" }] } },
  }) as any

  if (!challenge || !challenge.active) return { notFound: true }

  let enrollmentId: string | null = null
  if (session?.user?.id) {
    const enrollment = await db_.challengeEnrollment.findFirst({
      where: { userId: session.user.id, challengeId: challenge.id, status: "ACTIVE" },
    }) as any
    enrollmentId = enrollment?.id ?? null
  }

  return {
    props: {
      challenge: JSON.parse(JSON.stringify(challenge)),
      enrollmentId,
    },
  }
}

export default ChallengeDetailPage

import type { NextPageWithLayout } from "@/types/next"
import type { GetServerSideProps } from "next"
import Head from "next/head"
import Link from "next/link"
import { useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/router"
import { db } from "@/lib/db"
import { SiteLayout } from "@/components/layout/SiteLayout"

type PathwaysDb = {
  growthPathway: {
    findUnique: (args: any) => Promise<any | null>
  }
  pathwayEnrollment: {
    findFirst: (args: any) => Promise<any | null>
  }
}

type StageType = "MORNING_BOOST" | "BLOG" | "RESOURCE" | "CHALLENGE" | "ACTION" | "GROUP" | "BOOK" | "EVENT" | "PROVIDER"

interface Stage {
  id: string
  title: string
  description: string | null
  order: number
  stageType: StageType
  contentTitle: string | null
  actionPrompt: string | null
  estimatedMinutes: number | null
}

interface Pathway {
  id: string
  title: string
  slug: string
  description: string
  summary: string
  estimatedDays: number
  focusAreaIds: string[]
  stages: Stage[]
}

interface Props {
  pathway: Pathway
  enrollmentId: string | null
}

const STAGE_TYPE_LABELS: Record<StageType, string> = {
  MORNING_BOOST: "Morning Boost",
  BLOG: "Blog post",
  RESOURCE: "Resource",
  CHALLENGE: "Challenge",
  ACTION: "Action",
  GROUP: "Group activity",
  BOOK: "Book",
  EVENT: "Event",
  PROVIDER: "Provider",
}

const PathwayDetailPage: NextPageWithLayout<Props> = ({ pathway, enrollmentId: initialEnrollmentId }) => {
  const { data: session } = useSession()
  const router = useRouter()
  const [enrolling, setEnrolling] = useState(false)
  const [enrollmentId, setEnrollmentId] = useState<string | null>(initialEnrollmentId)
  const [enrollError, setEnrollError] = useState<string | null>(null)

  const totalMinutes = pathway.stages.reduce((sum, s) => sum + (s.estimatedMinutes ?? 0), 0)

  async function handleEnroll() {
    if (!session) {
      router.push(`/signin?callbackUrl=/pathways/${pathway.slug}`)
      return
    }
    setEnrolling(true)
    setEnrollError(null)
    try {
      const res = await fetch("/api/account/pathways/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pathwayId: pathway.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409) {
          setEnrollmentId(data.enrollmentId ?? "existing")
          return
        }
        setEnrollError(data.error ?? "Failed to enroll.")
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
      <Head><title>{pathway.title} — Fixer Nation</title></Head>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href="/pathways" className="text-sm text-ink-soft hover:text-navy no-underline">
            ← All pathways
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-navy">{pathway.title}</h1>
          <p className="mt-3 text-base text-ink-soft">{pathway.summary}</p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm text-ink-soft">
            <span className="rounded-full bg-navy/8 px-3 py-1 font-medium">
              {pathway.stages.length} stage{pathway.stages.length !== 1 ? "s" : ""}
            </span>
            <span className="rounded-full bg-navy/8 px-3 py-1 font-medium">
              ~{pathway.estimatedDays} days
            </span>
            {totalMinutes > 0 && (
              <span className="rounded-full bg-navy/8 px-3 py-1 font-medium">
                ~{Math.round(totalMinutes / 60)}h total
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="mb-8 rounded-2xl border border-navy/8 bg-white p-6">
          <p className="text-sm text-ink leading-relaxed">{pathway.description}</p>
        </div>

        {/* Enroll CTA */}
        <div className="mb-8">
          {enrollmentId ? (
            <div className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 px-5 py-4">
              <span className="text-sm font-semibold text-green-800">You are enrolled in this pathway.</span>
              <Link href="/account/pathways" className="ml-auto text-sm font-bold text-green-700 hover:underline no-underline">
                View my progress →
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl border border-navy/8 bg-white px-5 py-4 flex items-center justify-between gap-4">
              <p className="text-sm text-ink-soft">Ready to start? Enroll to track your progress through each stage.</p>
              <button
                onClick={handleEnroll}
                disabled={enrolling}
                className="shrink-0 rounded-xl bg-amber px-5 py-2.5 text-sm font-bold text-navy-dark hover:bg-amber-dark disabled:opacity-50"
              >
                {enrolling ? "Enrolling…" : session ? "Enroll now" : "Sign in to enroll"}
              </button>
            </div>
          )}
          {enrollError && (
            <p className="mt-2 text-sm text-red-600">{enrollError}</p>
          )}
        </div>

        {/* Stages list */}
        <h2 className="mb-4 text-lg font-bold text-navy">What you will cover</h2>
        <div className="space-y-3">
          {pathway.stages.map((stage, idx) => (
            <div key={stage.id} className="flex gap-4 rounded-2xl border border-navy/8 bg-white p-4">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber/20 text-sm font-bold text-amber-dark">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-navy">{stage.title}</span>
                  <span className="rounded-full bg-navy/8 px-2 py-0.5 text-xs font-medium text-ink-soft">
                    {STAGE_TYPE_LABELS[stage.stageType]}
                  </span>
                  {stage.estimatedMinutes && (
                    <span className="text-xs text-ink-soft">{stage.estimatedMinutes} min</span>
                  )}
                </div>
                {stage.actionPrompt && (
                  <p className="mt-1 text-sm text-ink-soft">{stage.actionPrompt}</p>
                )}
                {stage.contentTitle && (
                  <p className="mt-0.5 text-xs italic text-ink-soft">{stage.contentTitle}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

PathwayDetailPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const { getServerSession } = await import("next-auth")
  const { authOptions } = await import("@/lib/auth")

  const session = await getServerSession(ctx.req, ctx.res, authOptions)
  const slug = ctx.params?.slug as string

  const db_ = db as never as PathwaysDb
  const pathway = await db_.growthPathway.findUnique({
    where: { slug },
    include: { stages: { orderBy: { order: "asc" } } },
  }) as any

  if (!pathway || !pathway.active) return { notFound: true }

  let enrollmentId: string | null = null
  if (session?.user?.id) {
    const enrollment = await db_.pathwayEnrollment.findFirst({
      where: { userId: session.user.id, pathwayId: pathway.id, status: "ACTIVE" },
    }) as any
    enrollmentId = enrollment?.id ?? null
  }

  return {
    props: {
      pathway: JSON.parse(JSON.stringify(pathway)),
      enrollmentId,
    },
  }
}

export default PathwayDetailPage

import type { NextPageWithLayout } from "@/types/next"
import type { GetServerSideProps } from "next"
import Head from "next/head"
import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { SiteLayout } from "@/components/layout/SiteLayout"
import { AccountNav } from "@/components/account/AccountNav"

type PathwaysDb = {
  pathwayEnrollment: {
    findMany: (args?: any) => Promise<any[]>
  }
}

interface ProgressItem {
  stageId: string
}

interface EnrollmentRow {
  id: string
  status: string
  startedAt: string
  completedAt: string | null
  pathway: {
    id: string
    title: string
    slug: string
    summary: string
    estimatedDays: number
    stageCount: number
  }
  completedStages: number
}

interface Props {
  enrollments: EnrollmentRow[]
}

const MyPathwaysPage: NextPageWithLayout<Props> = ({ enrollments }) => {
  const active = enrollments.filter((e) => e.status === "ACTIVE" || e.status === "PAUSED")
  const completed = enrollments.filter((e) => e.status === "COMPLETED")

  return (
    <>
      <Head><title>My Pathways — Fixer Nation</title></Head>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <AccountNav />
        <div className="mt-6">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-extrabold text-navy">My Pathways</h1>
            <Link
              href="/pathways"
              className="rounded-xl border border-navy/15 px-4 py-2 text-sm font-bold text-ink-soft no-underline hover:bg-cream-panel"
            >
              Browse pathways
            </Link>
          </div>

          {enrollments.length === 0 ? (
            <div className="rounded-2xl border border-navy/8 bg-white p-12 text-center">
              <p className="text-sm text-ink-soft">You have not enrolled in any pathways yet.</p>
              <Link
                href="/pathways"
                className="mt-4 inline-block rounded-xl bg-amber px-5 py-2.5 text-sm font-bold text-navy-dark no-underline hover:bg-amber-dark"
              >
                Explore pathways
              </Link>
            </div>
          ) : (
            <>
              {active.length > 0 && (
                <div className="mb-8">
                  <h2 className="mb-3 text-base font-bold text-navy">In progress</h2>
                  <div className="space-y-3">
                    {active.map((e) => (
                      <EnrollmentCard key={e.id} enrollment={e} />
                    ))}
                  </div>
                </div>
              )}

              {completed.length > 0 && (
                <div>
                  <h2 className="mb-3 text-base font-bold text-navy">Completed</h2>
                  <div className="space-y-3">
                    {completed.map((e) => (
                      <EnrollmentCard key={e.id} enrollment={e} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

function EnrollmentCard({ enrollment }: { enrollment: EnrollmentRow }) {
  const pct = enrollment.pathway.stageCount > 0
    ? Math.round((enrollment.completedStages / enrollment.pathway.stageCount) * 100)
    : 0

  return (
    <div className="rounded-2xl border border-navy/8 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/pathways/${enrollment.pathway.slug}`}
              className="font-semibold text-navy hover:underline no-underline"
            >
              {enrollment.pathway.title}
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
          <p className="mt-0.5 text-xs text-ink-soft">{enrollment.pathway.summary}</p>
        </div>
        <div className="shrink-0 text-right">
          <span className="text-sm font-bold text-navy">{pct}%</span>
          <p className="text-xs text-ink-soft">
            {enrollment.completedStages} / {enrollment.pathway.stageCount} stages
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-navy/8">
        <div
          className="h-2 rounded-full bg-amber transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-ink-soft">
        <span>Started {new Date(enrollment.startedAt).toLocaleDateString()}</span>
        {enrollment.completedAt && enrollment.status === "COMPLETED" && (
          <span>Finished {new Date(enrollment.completedAt).toLocaleDateString()}</span>
        )}
        {enrollment.status === "ACTIVE" && (
          <Link
            href={`/pathways/${enrollment.pathway.slug}`}
            className="font-semibold text-navy hover:underline no-underline"
          >
            Continue →
          </Link>
        )}
      </div>
    </div>
  )
}

MyPathwaysPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions)
  if (!session) return { redirect: { destination: "/signin?callbackUrl=/account/pathways", permanent: false } }

  const db_ = db as never as PathwaysDb
  const enrollments = await db_.pathwayEnrollment.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      pathway: { include: { _count: { select: { stages: true } } } },
      progress: { select: { stageId: true } },
    },
  }) as any[]

  return {
    props: {
      enrollments: enrollments.map((e) => ({
        id: e.id,
        status: e.status,
        startedAt: e.startedAt.toISOString(),
        completedAt: e.completedAt ? e.completedAt.toISOString() : null,
        pathway: {
          id: e.pathway.id,
          title: e.pathway.title,
          slug: e.pathway.slug,
          summary: e.pathway.summary,
          estimatedDays: e.pathway.estimatedDays,
          stageCount: e.pathway._count.stages,
        },
        completedStages: (e.progress as ProgressItem[]).length,
      })),
    },
  }
}

export default MyPathwaysPage

import type { NextPageWithLayout } from "@/types/next"
import type { GetServerSideProps } from "next"
import Head from "next/head"
import Link from "next/link"
import { db } from "@/lib/db"
import { SiteLayout } from "@/components/layout/SiteLayout"

type ChallengesDb = {
  challenge: {
    findMany: (args?: any) => Promise<any[]>
  }
}

interface ChallengeCard {
  id: string
  title: string
  slug: string
  summary: string
  durationDays: number
  focusAreaIds: string[]
  stepCount: number
  enrollmentCount: number
}

interface Props {
  challenges: ChallengeCard[]
}

const ChallengesBrowsePage: NextPageWithLayout<Props> = ({ challenges }) => {
  return (
    <>
      <Head><title>Fixer Challenges — Fixer Nation</title></Head>
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-extrabold text-navy sm:text-4xl">Fixer Challenges</h1>
          <p className="mt-3 text-base text-ink-soft max-w-2xl mx-auto">
            Focused day-by-day challenges to help you build real momentum. Pick one, commit, and show up.
          </p>
        </div>

        {challenges.length === 0 ? (
          <div className="rounded-2xl border border-navy/8 bg-white p-12 text-center">
            <p className="text-sm text-ink-soft">No challenges available right now. Check back soon.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {challenges.map((challenge) => (
              <Link
                key={challenge.id}
                href={`/challenges/${challenge.slug}`}
                className="group block rounded-2xl border border-navy/8 bg-white p-6 no-underline transition-shadow hover:shadow-md"
              >
                <h2 className="text-lg font-bold text-navy group-hover:text-amber-dark transition-colors">
                  {challenge.title}
                </h2>
                <p className="mt-2 text-sm text-ink-soft line-clamp-3">{challenge.summary}</p>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-ink-soft">
                  <span className="rounded-full bg-navy/8 px-2.5 py-1 font-medium">
                    {challenge.durationDays} day{challenge.durationDays !== 1 ? "s" : ""}
                  </span>
                  <span className="rounded-full bg-navy/8 px-2.5 py-1 font-medium">
                    {challenge.stepCount} step{challenge.stepCount !== 1 ? "s" : ""}
                  </span>
                  {challenge.enrollmentCount > 0 && (
                    <span className="rounded-full bg-amber/15 px-2.5 py-1 font-medium text-amber-dark">
                      {challenge.enrollmentCount} joined
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

ChallengesBrowsePage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  const db_ = db as never as ChallengesDb
  const challenges = await db_.challenge.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { steps: true, enrollments: true } } },
  }) as any[]

  return {
    props: {
      challenges: challenges.map((c) => ({
        id: c.id,
        title: c.title,
        slug: c.slug,
        summary: c.summary,
        durationDays: c.durationDays,
        focusAreaIds: c.focusAreaIds,
        stepCount: c._count.steps,
        enrollmentCount: c._count.enrollments,
      })),
    },
  }
}

export default ChallengesBrowsePage

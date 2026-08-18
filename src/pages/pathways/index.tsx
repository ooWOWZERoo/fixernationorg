import type { NextPageWithLayout } from "@/types/next"
import type { GetServerSideProps } from "next"
import Head from "next/head"
import Link from "next/link"
import { db } from "@/lib/db"
import { SiteLayout } from "@/components/layout/SiteLayout"

type PathwaysDb = {
  growthPathway: {
    findMany: (args?: any) => Promise<any[]>
  }
}

interface PathwayCard {
  id: string
  title: string
  slug: string
  summary: string
  estimatedDays: number
  focusAreaIds: string[]
  stageCount: number
}

interface Props {
  pathways: PathwayCard[]
}

const PathwaysBrowsePage: NextPageWithLayout<Props> = ({ pathways }) => {
  return (
    <>
      <Head><title>Growth Pathways — Fixer Nation</title></Head>
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-extrabold text-navy sm:text-4xl">Growth Pathways</h1>
          <p className="mt-3 text-base text-ink-soft max-w-2xl mx-auto">
            Structured programs to help you build momentum — one step at a time.
          </p>
        </div>

        {pathways.length === 0 ? (
          <div className="rounded-2xl border border-navy/8 bg-white p-12 text-center">
            <p className="text-sm text-ink-soft">No pathways available yet. Check back soon.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {pathways.map((pathway) => (
              <Link
                key={pathway.id}
                href={`/pathways/${pathway.slug}`}
                className="group block rounded-2xl border border-navy/8 bg-white p-6 no-underline transition-shadow hover:shadow-md"
              >
                <h2 className="text-lg font-bold text-navy group-hover:text-amber-dark transition-colors">
                  {pathway.title}
                </h2>
                <p className="mt-2 text-sm text-ink-soft line-clamp-3">{pathway.summary}</p>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-ink-soft">
                  <span className="rounded-full bg-navy/8 px-2.5 py-1 font-medium">
                    {pathway.stageCount} stage{pathway.stageCount !== 1 ? "s" : ""}
                  </span>
                  <span className="rounded-full bg-navy/8 px-2.5 py-1 font-medium">
                    ~{pathway.estimatedDays} days
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

PathwaysBrowsePage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  const db_ = db as never as PathwaysDb
  const pathways = await db_.growthPathway.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { stages: true } } },
  }) as any[]

  return {
    props: {
      pathways: pathways.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        summary: p.summary,
        estimatedDays: p.estimatedDays,
        focusAreaIds: p.focusAreaIds,
        stageCount: p._count.stages,
      })),
    },
  }
}

export default PathwaysBrowsePage

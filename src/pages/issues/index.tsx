import type { NextPageWithLayout } from "@/types/next"
import type { GetServerSideProps } from "next"
import Head from "next/head"
import Link from "next/link"
import { db } from "@/lib/db"
import { SiteLayout } from "@/components/layout/SiteLayout"

type TopicCard = {
  id: string
  title: string
  slug: string
  description: string | null
}

type Props = { topics: TopicCard[] }

type IssueTopicsDb = {
  issueTopic: {
    findMany: (args?: Record<string, unknown>) => Promise<TopicCard[]>
  }
}

const IssuesBrowsePage: NextPageWithLayout<Props> = ({ topics }) => {
  return (
    <>
      <Head>
        <title>What&apos;s going on? — Fixer Nation</title>
      </Head>
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-extrabold text-navy sm:text-4xl">What&apos;s going on?</h1>
          <p className="mt-3 text-base text-ink-soft max-w-2xl mx-auto">
            Pick the challenge that sounds most like yours and we&apos;ll point you to the resources, pathways, and challenges that can help.
          </p>
        </div>

        {topics.length === 0 ? (
          <div className="rounded-2xl border border-navy/8 bg-white p-12 text-center">
            <p className="text-sm text-ink-soft">No topics available yet. Check back soon.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {topics.map((topic) => (
              <Link
                key={topic.id}
                href={`/issues/${topic.slug}`}
                className="group block rounded-2xl border border-navy/8 bg-white p-6 no-underline transition-shadow hover:shadow-md"
              >
                <h2 className="text-base font-bold text-navy group-hover:text-amber-dark transition-colors">
                  {topic.title}
                </h2>
                {topic.description && (
                  <p className="mt-2 text-sm text-ink-soft line-clamp-3">{topic.description}</p>
                )}
                <p className="mt-4 text-xs font-semibold text-amber-dark">
                  See what can help →
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

IssuesBrowsePage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  const db_ = db as never as IssueTopicsDb
  const topics = await db_.issueTopic.findMany({
    where: { active: true },
    orderBy: { order: "asc" },
    select: { id: true, title: true, slug: true, description: true },
  })

  return { props: { topics: JSON.parse(JSON.stringify(topics)) } }
}

export default IssuesBrowsePage

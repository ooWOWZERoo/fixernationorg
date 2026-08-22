import type { NextPageWithLayout } from "@/types/next"
import type { GetServerSideProps } from "next"
import { useState } from "react"
import Head from "next/head"
import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { SiteLayout } from "@/components/layout/SiteLayout"

type RecommendationRow = {
  id: string
  recommendationType: string
  resourceId: string
  resourceTitle: string
  priority: number
}

type TopicDetail = {
  id: string
  title: string
  slug: string
  description: string | null
  recommendationMaps: RecommendationRow[]
}

type ExistingIssue = {
  id: string
  resolved: boolean
} | null

type Props = {
  topic: TopicDetail
  existingIssue: ExistingIssue
  isSignedIn: boolean
}

type IssueTopicsDb = {
  issueTopic: {
    findUnique: (args: Record<string, unknown>) => Promise<unknown | null>
  }
}

type MemberIssueDb = {
  memberIssue: {
    findFirst: (args: Record<string, unknown>) => Promise<ExistingIssue>
  }
}

const REC_TYPE_LABELS: Record<string, string> = {
  PATHWAY: "Pathways",
  CHALLENGE: "Challenges",
  RESOURCE: "Resources",
  BLOG_POST: "Blog Posts",
}

const REC_HREF: Record<string, (id: string) => string> = {
  PATHWAY: (id) => `/pathways/${id}`,
  CHALLENGE: (id) => `/challenges/${id}`,
  RESOURCE: () => `/resources`,
  BLOG_POST: (id) => `/blog/${id}`,
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item)
    if (!acc[k]) acc[k] = []
    acc[k].push(item)
    return acc
  }, {})
}

const IssueDetailPage: NextPageWithLayout<Props> = ({ topic, existingIssue: initial, isSignedIn }) => {
  const [existingIssue, setExistingIssue] = useState(initial)
  const [logging, setLogging] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [untracking, setUntracking] = useState(false)

  const grouped = groupBy(topic.recommendationMaps, (r) => r.recommendationType)
  const typeOrder = ["PATHWAY", "CHALLENGE", "RESOURCE", "BLOG_POST"]

  async function handleLog() {
    setLogging(true)
    try {
      const res = await fetch("/api/account/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueTopicId: topic.id }),
      })
      const data = await res.json()
      if (res.ok) {
        setExistingIssue({ id: data.issue.id, resolved: false })
      }
    } finally {
      setLogging(false)
    }
  }

  async function handleUntrack() {
    if (!existingIssue) return
    setUntracking(true)
    try {
      const res = await fetch(`/api/account/issues/${existingIssue.id}`, { method: "DELETE" })
      if (res.ok || res.status === 204) {
        setExistingIssue(null)
      }
    } finally {
      setUntracking(false)
    }
  }

  async function handleToggleResolved() {
    if (!existingIssue) return
    setToggling(true)
    try {
      const res = await fetch(`/api/account/issues/${existingIssue.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved: !existingIssue.resolved }),
      })
      const data = await res.json()
      if (res.ok) {
        setExistingIssue({ id: data.issue.id, resolved: data.issue.resolved })
      }
    } finally {
      setToggling(false)
    }
  }

  return (
    <>
      <Head>
        <title>{topic.title} — Fixer Nation</title>
      </Head>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-4">
          <Link href="/issues" className="text-sm text-ink-soft hover:text-navy no-underline">
            ← What&apos;s going on?
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-navy">{topic.title}</h1>
          {topic.description && (
            <p className="mt-3 text-base text-ink-soft max-w-2xl">{topic.description}</p>
          )}

          {isSignedIn && (
            <div className="mt-5">
              {!existingIssue ? (
                <button
                  onClick={handleLog}
                  disabled={logging}
                  className="rounded-xl bg-amber px-5 py-2.5 text-sm font-bold text-navy-dark hover:bg-amber-dark disabled:opacity-50"
                >
                  {logging ? "Logging…" : "I'm dealing with this"}
                </button>
              ) : (
                <div className="flex items-center gap-4">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${
                      existingIssue.resolved
                        ? "bg-green-100 text-green-700"
                        : "bg-amber/20 text-amber-dark"
                    }`}
                  >
                    {existingIssue.resolved ? "Resolved" : "Tracking this issue"}
                  </span>
                  <button
                    onClick={handleToggleResolved}
                    disabled={toggling}
                    className="text-sm font-semibold text-ink-soft underline hover:text-navy disabled:opacity-50"
                  >
                    {toggling
                      ? "Updating…"
                      : existingIssue.resolved
                      ? "Mark as unresolved"
                      : "Mark as resolved"}
                  </button>
                  <button
                    onClick={handleUntrack}
                    disabled={untracking}
                    className="text-sm font-semibold text-red-500 underline hover:text-red-700 disabled:opacity-50"
                  >
                    {untracking ? "Removing…" : "Stop tracking"}
                  </button>
                </div>
              )}
            </div>
          )}

          {!isSignedIn && (
            <p className="mt-4 text-sm text-ink-soft">
              <Link href="/signin" className="font-semibold text-navy underline">
                Sign in
              </Link>{" "}
              to track this issue and get matched to resources.
            </p>
          )}
        </div>

        {topic.recommendationMaps.length === 0 ? (
          <div className="rounded-2xl border border-navy/8 bg-white p-10 text-center">
            <p className="text-sm text-ink-soft">No recommendations mapped to this topic yet.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {typeOrder
              .filter((t) => grouped[t]?.length)
              .map((type) => (
                <div key={type}>
                  <h2 className="mb-4 text-lg font-bold text-navy">{REC_TYPE_LABELS[type]}</h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {grouped[type].map((rec) => (
                      <Link
                        key={rec.id}
                        href={REC_HREF[type]?.(rec.resourceId) ?? "#"}
                        className="group block rounded-2xl border border-navy/8 bg-white p-5 no-underline transition-shadow hover:shadow-md"
                      >
                        <p className="font-semibold text-navy group-hover:text-amber-dark transition-colors">
                          {rec.resourceTitle}
                        </p>
                        <p className="mt-1.5 text-xs font-semibold text-ink-soft uppercase tracking-wide">
                          {REC_TYPE_LABELS[rec.recommendationType] ?? rec.recommendationType}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </>
  )
}

IssueDetailPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const { slug } = ctx.params as { slug: string }

  const db_ = db as never as IssueTopicsDb
  const topic = await db_.issueTopic.findUnique({
    where: { slug },
    include: {
      recommendationMaps: {
        orderBy: { priority: "desc" },
      },
    },
  })

  if (!topic || !(topic as { active: boolean }).active) return { notFound: true }

  // recommendationMaps.resourceId stores the pathway/challenge/blog post's
  // DB id (that's what the admin form asks for), but their public pages are
  // looked up by slug — resolve id -> slug here so the links actually work,
  // rather than changing what gets stored.
  const recs = (topic as { recommendationMaps: RecommendationRow[] }).recommendationMaps
  const idsByType = {
    PATHWAY: recs.filter((r) => r.recommendationType === "PATHWAY").map((r) => r.resourceId),
    CHALLENGE: recs.filter((r) => r.recommendationType === "CHALLENGE").map((r) => r.resourceId),
    BLOG_POST: recs.filter((r) => r.recommendationType === "BLOG_POST").map((r) => r.resourceId),
  }
  const [pathwaySlugs, challengeSlugs, blogSlugs] = await Promise.all([
    idsByType.PATHWAY.length
      ? db.growthPathway.findMany({ where: { id: { in: idsByType.PATHWAY } }, select: { id: true, slug: true } })
      : Promise.resolve([]),
    idsByType.CHALLENGE.length
      ? db.challenge.findMany({ where: { id: { in: idsByType.CHALLENGE } }, select: { id: true, slug: true } })
      : Promise.resolve([]),
    idsByType.BLOG_POST.length
      ? db.blogPost.findMany({ where: { id: { in: idsByType.BLOG_POST } }, select: { id: true, slug: true } })
      : Promise.resolve([]),
  ])
  const slugById = new Map(
    [...pathwaySlugs, ...challengeSlugs, ...blogSlugs].map((r) => [r.id, r.slug])
  )
  for (const rec of recs) {
    const slug = slugById.get(rec.resourceId)
    if (slug) rec.resourceId = slug
  }

  const session = await getServerSession(ctx.req, ctx.res, authOptions)
  let existingIssue: ExistingIssue = null

  if (session?.user?.id) {
    const mdb = db as never as MemberIssueDb
    existingIssue = await mdb.memberIssue.findFirst({
      where: { userId: session.user.id, issueTopicId: (topic as { id: string }).id },
      select: { id: true, resolved: true },
    })
  }

  return {
    props: {
      topic: JSON.parse(JSON.stringify(topic)),
      existingIssue: existingIssue ? JSON.parse(JSON.stringify(existingIssue)) : null,
      isSignedIn: !!session?.user?.id,
    },
  }
}

export default IssueDetailPage

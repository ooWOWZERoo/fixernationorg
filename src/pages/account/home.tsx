import type { NextPageWithLayout } from "@/types/next"
import type { GetServerSideProps } from "next"
import Head from "next/head"
import Link from "next/link"
import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { SiteLayout } from "@/components/layout/SiteLayout"
import { AccountNav } from "@/components/account/AccountNav"

interface FeedbackRow {
  id: string
  action: string
  createdAt: string
}

interface RecommendationRow {
  id: string
  category: string
  resourceId: string
  resourceTitle: string
  resourceSlug: string | null
  reason: string | null
  date: string
  feedback: FeedbackRow | null
}

interface Props {
  firstName: string | null
}

const CATEGORY_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  CHALLENGE: { label: "Challenge", bg: "bg-purple-100", text: "text-purple-800" },
  PATHWAY:   { label: "Pathway",   bg: "bg-blue-100",   text: "text-blue-800"   },
  ISSUE:     { label: "Issue",     bg: "bg-orange-100", text: "text-orange-800" },
  CONTENT:   { label: "Read",      bg: "bg-green-100",  text: "text-green-800"  },
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

function resourceHref(rec: RecommendationRow): string {
  switch (rec.category) {
    case "CHALLENGE":
      return rec.resourceSlug ? `/challenges/${rec.resourceSlug}` : "/challenges"
    case "PATHWAY":
      return rec.resourceSlug ? `/pathways/${rec.resourceSlug}` : "/account/pathways"
    case "ISSUE":
      return rec.resourceSlug ? `/issues/${rec.resourceSlug}` : "/account/issues"
    case "CONTENT":
      return rec.resourceSlug ? `/blog/${rec.resourceSlug}` : "/blog"
    default:
      return "/dashboard"
  }
}

const QUICK_LINKS = [
  { label: "My Plan",       href: "/account/my-plan"    },
  { label: "My Challenges", href: "/account/challenges" },
  { label: "My Pathways",   href: "/account/pathways"   },
  { label: "Daily Check-In",href: "/account/checkin"    },
  { label: "Reflections",   href: "/account/reflections"},
]

const PersonalizedHomePage: NextPageWithLayout<Props> = ({ firstName }) => {
  const { data: session } = useSession()
  const [rec, setRec] = useState<RecommendationRow | null | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const displayName = firstName ?? session?.user?.name?.split(" ")[0] ?? null

  useEffect(() => {
    fetch("/api/account/recommendation/today")
      .then((r) => r.json())
      .then((data) => {
        setRec(data.recommendation ?? null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function handleAction(action: "ACTED" | "SKIPPED" | "SAVED") {
    if (!rec) return
    setActing(true)
    try {
      const res = await fetch(`/api/account/recommendation/${rec.id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        const data = await res.json()
        setRec(data.recommendation)
        if (action === "ACTED") showToast("You're on it — 10 points awarded!")
        if (action === "SAVED") showToast("Saved for later.")
        if (action === "SKIPPED") showToast("Got it. Check back tomorrow.")
      }
    } finally {
      setActing(false)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    try {
      const res = await fetch("/api/account/recommendation/refresh", { method: "POST" })
      if (res.ok) {
        const data = await res.json()
        setRec(data.recommendation ?? null)
        showToast("Here's a fresh suggestion.")
      }
    } finally {
      setRefreshing(false)
    }
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const badge = rec ? (CATEGORY_BADGE[rec.category] ?? { label: rec.category, bg: "bg-gray-100", text: "text-gray-700" }) : null
  const action = rec?.feedback?.action ?? null
  const href = rec ? resourceHref(rec) : "#"

  return (
    <>
      <Head>
        <title>My Home — Fixer Nation</title>
      </Head>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-navy px-5 py-3 text-sm font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}

      <section className="px-6 py-8 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <AccountNav />

        <div className="mt-8">
          {/* Greeting */}
          <h1 className="text-2xl font-extrabold text-navy sm:text-3xl">
            {getGreeting()}{displayName ? `, ${displayName}` : ""}.
          </h1>
          <p className="mt-1 text-sm text-ink-soft">Here's what we think you should focus on today.</p>

          {/* One Thing Today card */}
          <div className="mt-6 rounded-2xl border border-navy/10 bg-white p-6 sm:p-8">
            <p className="mb-4 text-xs font-bold uppercase tracking-widest text-amber-dark">
              One thing today
            </p>

            {loading ? (
              <div className="space-y-3">
                <div className="h-4 w-24 animate-pulse rounded bg-navy/8" />
                <div className="h-6 w-3/4 animate-pulse rounded bg-navy/8" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-navy/8" />
              </div>
            ) : !rec ? (
              <div className="text-center py-4">
                <p className="text-sm text-ink-soft">
                  No recommendation yet — try setting your{" "}
                  <Link href="/account/focus" className="underline underline-offset-2 hover:text-navy">
                    focus areas
                  </Link>{" "}
                  or joining a{" "}
                  <Link href="/challenges" className="underline underline-offset-2 hover:text-navy">
                    challenge
                  </Link>
                  .
                </p>
              </div>
            ) : (
              <>
                {badge && (
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.bg} ${badge.text} mb-3`}>
                    {badge.label}
                  </span>
                )}

                <h2 className="text-xl font-extrabold text-navy sm:text-2xl leading-snug">
                  {rec.resourceTitle}
                </h2>

                {rec.reason && (
                  <p className="mt-2 text-sm text-ink-soft">{rec.reason}</p>
                )}

                <div className="mt-6">
                  {action === "ACTED" ? (
                    <div className="flex flex-wrap items-center gap-4">
                      <span className="inline-flex items-center gap-1.5 rounded-xl bg-green-100 px-4 py-2 text-sm font-bold text-green-800">
                        You&apos;re on it! ✓
                      </span>
                      <Link
                        href={href}
                        className="text-sm font-semibold text-navy underline underline-offset-2 hover:text-navy-dark"
                      >
                        Go there now →
                      </Link>
                    </div>
                  ) : action === "SAVED" ? (
                    <div className="flex flex-wrap items-center gap-4">
                      <span className="inline-flex items-center gap-1.5 rounded-xl bg-blue-100 px-4 py-2 text-sm font-bold text-blue-800">
                        Saved ✓
                      </span>
                      <button
                        onClick={() => handleAction("SKIPPED")}
                        disabled={acting}
                        className="text-sm text-ink-soft underline underline-offset-2 hover:text-navy disabled:opacity-50"
                      >
                        Not for me
                      </button>
                    </div>
                  ) : action === "SKIPPED" ? (
                    <p className="text-sm font-semibold text-ink-soft">
                      Got it. Check back tomorrow.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => handleAction("ACTED")}
                        disabled={acting}
                        className="rounded-xl bg-amber px-5 py-2.5 text-sm font-bold text-navy-dark transition hover:bg-amber-dark disabled:opacity-50"
                      >
                        Let&apos;s do it →
                      </button>
                      <button
                        onClick={() => handleAction("SAVED")}
                        disabled={acting}
                        className="rounded-xl border border-navy/15 px-5 py-2.5 text-sm font-semibold text-navy transition hover:bg-cream-panel disabled:opacity-50"
                      >
                        Save for later
                      </button>
                      <button
                        onClick={() => handleAction("SKIPPED")}
                        disabled={acting}
                        className="rounded-xl border border-navy/15 px-5 py-2.5 text-sm font-semibold text-ink-soft transition hover:bg-cream-panel disabled:opacity-50"
                      >
                        Not for me
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <button
                    onClick={handleRefresh}
                    disabled={refreshing || acting}
                    className="text-xs text-ink-soft underline underline-offset-2 hover:text-navy disabled:opacity-50"
                  >
                    {refreshing ? "Finding something new…" : "Get a different suggestion"}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Quick links */}
          <div className="mt-6">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-ink-soft">Jump to</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-xl border border-navy/12 bg-white px-4 py-2 text-sm font-semibold text-navy no-underline transition hover:bg-cream-panel"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
      </section>
    </>
  )
}

PersonalizedHomePage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions)
  if (!session) return { redirect: { destination: "/signin", permanent: false } }

  const memberRoles = ["MEMBER", "PROVIDER", "AMBASSADOR"]
  if (!memberRoles.includes(session.user.role)) {
    return { redirect: { destination: "/join", permanent: false } }
  }

  const firstName = session.user.name ? session.user.name.split(" ")[0] : null

  return { props: { firstName } }
}

export default PersonalizedHomePage

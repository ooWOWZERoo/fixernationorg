import type { NextPageWithLayout } from "@/types/next"
import type { GetServerSideProps } from "next"
import Head from "next/head"
import { useState, useEffect, useCallback } from "react"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { SiteLayout } from "@/components/layout/SiteLayout"
import { AccountNav } from "@/components/account/AccountNav"
import { TB_GAME_REGISTRY } from "@/lib/tuneBrain/registry"

interface SessionOption {
  id: string
  label: string
}

interface SessionContentItem {
  id: string
  prompt: string
  difficulty: number | null
  category: string | null
  options: SessionOption[]
}

interface CompleteResult {
  wasCorrect: boolean
  explanation: string | null
}

interface Props {
  hasTimezone: boolean
}

const GAME_KEY = "POSITIVE_REFRAME"

const TuneYourBrainPage: NextPageWithLayout<Props> = ({ hasTimezone }) => {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [contentItem, setContentItem] = useState<SessionContentItem | null>(null)
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [result, setResult] = useState<CompleteResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startSession = useCallback(async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    setSelectedOptionId(null)
    setContentItem(null)
    try {
      const res = await fetch("/api/account/tune-your-brain/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameKey: GAME_KEY }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Couldn't load a scenario.")
      setSessionId(data.sessionId)
      setContentItem(data.contentItem)
    } catch {
      setError("Couldn't load that. Try again in a minute.")
    } finally {
      setLoading(false)
    }
  }, [])

  // Fire-and-forget, best-effort timezone capture -- never block rendering
  // on it, and only send it once (getServerSideProps already tells us if
  // the member has a stored timezone).
  useEffect(() => {
    if (hasTimezone) return
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (timezone) {
        fetch("/api/account/timezone", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timezone }),
        }).catch(() => {})
      }
    } catch {
      // Best-effort only.
    }
  }, [hasTimezone])

  useEffect(() => {
    startSession()
  }, [startSession])

  async function handleSelect(optionId: string) {
    if (!sessionId || submitting || result) return
    setSelectedOptionId(optionId)
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/account/tune-your-brain/sessions/${sessionId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Something went wrong")
      setResult({ wasCorrect: data.wasCorrect, explanation: data.explanation })
    } catch {
      setError("That didn't save. Try again.")
      setSelectedOptionId(null)
    } finally {
      setSubmitting(false)
    }
  }

  const gameDef = TB_GAME_REGISTRY[GAME_KEY]

  return (
    <>
      <Head>
        <title>Tune Your Brain — Fixer Nation</title>
      </Head>
      <section className="px-6 py-8 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <AccountNav />

          <div className="mb-2 flex items-center gap-2">
            <span className="text-2xl" aria-hidden="true">🧠</span>
            <h1 className="text-2xl font-extrabold text-navy">Tune Your Brain</h1>
          </div>
          <p className="text-sm text-ink-soft mb-6">
            A quick way to practice meeting everyday setbacks with a clear head instead of a harsh one.
          </p>

          {error && (
            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <div className="rounded-2xl border border-navy/8 bg-white p-6">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-amber-dark mb-3">
              {gameDef.label}
            </h2>

            {loading ? (
              <p className="text-sm text-ink-soft">Pulling up a scenario…</p>
            ) : contentItem ? (
              <>
                <p className="text-base font-semibold text-navy mb-5">{contentItem.prompt}</p>

                <div className="space-y-2">
                  {contentItem.options.map((opt) => {
                    const isSelected = selectedOptionId === opt.id
                    const showFeedback = !!result && isSelected
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={!!result || submitting}
                        onClick={() => handleSelect(opt.id)}
                        className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                          showFeedback
                            ? result?.wasCorrect
                              ? "border-green-400 bg-green-50"
                              : "border-amber bg-amber/10"
                            : isSelected
                              ? "border-amber bg-amber/10"
                              : "border-navy/10 hover:border-amber/50 hover:bg-cream-panel"
                        } ${result && !isSelected ? "opacity-50" : ""}`}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>

                {result && (
                  <div className="mt-5 rounded-xl bg-cream-panel border border-navy/8 p-4">
                    <p className="text-sm font-bold text-navy mb-1">
                      {result.wasCorrect ? "That's a solid reframe." : "Here's another way to look at it:"}
                    </p>
                    {result.explanation && (
                      <p className="text-sm text-ink-soft">{result.explanation}</p>
                    )}
                    <button
                      type="button"
                      onClick={startSession}
                      className="mt-4 rounded-xl bg-amber px-5 py-2 text-sm font-bold text-navy-dark hover:bg-amber-dark transition-colors"
                    >
                      Play again
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-ink-soft">
                Nothing to play right now. Check back soon.
              </p>
            )}
          </div>
        </div>
      </section>
    </>
  )
}

TuneYourBrainPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions)
  if (!session) return { redirect: { destination: "/signin?callbackUrl=/tune-your-brain", permanent: false } }

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  const timezone = (user as unknown as { timezone: string | null } | null)?.timezone

  return { props: { hasTimezone: !!timezone } }
}

export default TuneYourBrainPage

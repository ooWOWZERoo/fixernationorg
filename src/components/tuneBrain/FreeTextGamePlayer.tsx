import { useState, useEffect, useCallback } from "react"

// Client player for every "kind: FREE_TEXT" game (currently just Gratitude
// Quest) -- a prompt, a private free-text response, no correctness
// concept. Completion itself is the reward. The response body is only
// ever sent to the complete endpoint, which writes it to TbGratitudeEntry
// server-side -- it never round-trips back into this component's state
// beyond what the member just typed.

interface SessionContentItem {
  id: string
  prompt: string
  category: string | null
}

interface FreeTextGamePlayerProps {
  gameKey: string
  placeholder?: string
}

export function FreeTextGamePlayer({
  gameKey,
  placeholder = "Write a sentence or two…",
}: FreeTextGamePlayerProps) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [contentItem, setContentItem] = useState<SessionContentItem | null>(null)
  const [responseBody, setResponseBody] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startSession = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSubmitted(false)
    setResponseBody("")
    setContentItem(null)
    try {
      const res = await fetch("/api/account/tune-your-brain/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameKey }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Couldn't load a prompt.")
      setSessionId(data.sessionId)
      setContentItem(data.contentItem)
    } catch {
      setError("Couldn't load that. Try again in a minute.")
    } finally {
      setLoading(false)
    }
  }, [gameKey])

  useEffect(() => {
    startSession()
  }, [startSession])

  async function handleSubmit() {
    if (!sessionId || submitting || submitted || !responseBody.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/account/tune-your-brain/sessions/${sessionId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseBody: responseBody.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Something went wrong")
      setSubmitted(true)
    } catch {
      setError("That didn't save. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-2xl border border-navy/8 bg-white p-6">
      {error && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-ink-soft">Pulling up a prompt…</p>
      ) : contentItem ? (
        <>
          {contentItem.category && (
            <span className="mb-2 inline-block rounded-full bg-cream-panel px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-dark">
              {contentItem.category}
            </span>
          )}
          <p className="text-base font-semibold text-navy mb-4">{contentItem.prompt}</p>

          {submitted ? (
            <div className="rounded-xl bg-cream-panel border border-navy/8 p-4">
              <p className="text-sm font-bold text-navy mb-1">Thanks for sharing that.</p>
              <p className="text-sm text-ink-soft">
                What you wrote stays private -- it's just for you. Noticing it is the whole point.
              </p>
              <button
                type="button"
                onClick={startSession}
                className="mt-4 rounded-xl bg-amber px-5 py-2 text-sm font-bold text-navy-dark hover:bg-amber-dark transition-colors"
              >
                Another prompt
              </button>
            </div>
          ) : (
            <>
              <textarea
                value={responseBody}
                onChange={(e) => setResponseBody(e.target.value)}
                placeholder={placeholder}
                rows={4}
                maxLength={2000}
                disabled={submitting}
                className="w-full rounded-xl border border-navy/15 px-4 py-3 text-sm text-navy focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber"
              />
              <p className="mt-1 text-xs text-ink-soft/70">Just for you -- this is never shared or published.</p>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !responseBody.trim()}
                className="mt-4 rounded-xl bg-amber px-5 py-2 text-sm font-bold text-navy-dark hover:bg-amber-dark transition-colors disabled:opacity-50"
              >
                {submitting ? "Saving…" : "Save"}
              </button>
            </>
          )}
        </>
      ) : (
        <p className="text-sm text-ink-soft">Nothing to play right now. Check back soon.</p>
      )}
    </div>
  )
}

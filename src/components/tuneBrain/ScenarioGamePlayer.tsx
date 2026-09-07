import { useState, useEffect, useCallback } from "react"

// Shared client player for every "kind: SCENARIO" game (Positive Reframe,
// Strength Spotter, Wellness Choices) -- a short prompt with 4 options,
// exactly one best/correct, server-authoritative. No db-touching import
// here; this is a plain client component parameterized by gameKey.

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
  wasCorrect: boolean | null
  explanation: string | null
}

interface ScenarioGamePlayerProps {
  gameKey: string
  correctLabel?: string
  incorrectLabel?: string
}

export function ScenarioGamePlayer({
  gameKey,
  correctLabel = "Nice pick.",
  incorrectLabel = "Here's another way to look at it:",
}: ScenarioGamePlayerProps) {
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
        body: JSON.stringify({ gameKey }),
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
  }, [gameKey])

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

  return (
    <div className="rounded-2xl border border-navy/8 bg-white p-6">
      {error && (
        <div role="alert" className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-ink-soft">Pulling up a scenario…</p>
      ) : contentItem ? (
        <>
          <p className="text-base font-semibold text-navy mb-5">{contentItem.prompt}</p>

          <div className="space-y-2" role="group" aria-label="Answer options">
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
                  {showFeedback && (
                    <span className="ml-2 font-semibold">
                      · {result?.wasCorrect ? "Nice pick" : "Not this one"}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {result && (
            <div role="status" aria-live="polite" className="mt-5 rounded-xl bg-cream-panel border border-navy/8 p-4">
              <p className="text-sm font-bold text-navy mb-1">
                {result.wasCorrect ? correctLabel : incorrectLabel}
              </p>
              {result.explanation && <p className="text-sm text-ink-soft">{result.explanation}</p>}
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
        <p className="text-sm text-ink-soft">Nothing to play right now. Check back soon.</p>
      )}
    </div>
  )
}

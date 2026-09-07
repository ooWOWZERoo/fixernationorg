import { useState, useEffect, useRef, useCallback } from "react"

// Client player for "kind: CALM_FOCUS" -- not scored on "how well you
// relaxed"; completion itself is the reward. Two modes seeded as separate
// TbContentItem rows (category "breathing" / "notice"), picked explicitly
// by the member rather than randomly, since they're different exercises,
// not variations on one prompt. Genuinely respects reduced motion: checks
// prefers-reduced-motion on mount AND offers an in-page toggle, and the
// reduced-motion path never animates the breathing circle.

type Mode = "breathing" | "notice"

interface BreathingPayload {
  durationOptions?: number[]
}

interface NoticePayload {
  prompts?: string[]
}

interface SessionContentItem {
  id: string
  payload: BreathingPayload & NoticePayload
}

interface CalmFocusPlayerProps {
  gameKey: string
}

const BREATH_PHASES: { label: string; seconds: number }[] = [
  { label: "Breathe in", seconds: 4 },
  { label: "Hold", seconds: 2 },
  { label: "Breathe out", seconds: 4 },
]

function formatSeconds(total: number): string {
  const m = Math.floor(total / 60)
  const s = total % 60
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`
}

export function CalmFocusPlayer({ gameKey }: CalmFocusPlayerProps) {
  const [mode, setMode] = useState<Mode | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [contentItem, setContentItem] = useState<SessionContentItem | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [finished, setFinished] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Breathing-mode state
  const [duration, setDuration] = useState<number | null>(null)
  const [remaining, setRemaining] = useState(0)
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)

  // Notice-mode state
  const [promptIndex, setPromptIndex] = useState(0)

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const phaseTimeRef = useRef(0)

  useEffect(() => {
    try {
      setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    } catch {
      // Best-effort only.
    }
  }, [])

  const chooseMode = useCallback(
    async (chosenMode: Mode) => {
      setLoading(true)
      setError(null)
      setFinished(false)
      setDuration(null)
      setPromptIndex(0)
      try {
        const res = await fetch("/api/account/tune-your-brain/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameKey, category: chosenMode }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? "Couldn't load that.")
        setMode(chosenMode)
        setSessionId(data.sessionId)
        setContentItem(data.contentItem)
      } catch {
        setError("Couldn't load that. Try again in a minute.")
      } finally {
        setLoading(false)
      }
    },
    [gameKey]
  )

  const startBreathing = useCallback((seconds: number) => {
    setDuration(seconds)
    setRemaining(seconds)
    setPhaseIndex(0)
    phaseTimeRef.current = 0
    if (tickRef.current) clearInterval(tickRef.current)
    tickRef.current = setInterval(() => {
      setRemaining((r) => (r > 0 ? r - 1 : 0))
      phaseTimeRef.current += 1
      setPhaseIndex((idx) => {
        const currentPhase = BREATH_PHASES[idx % BREATH_PHASES.length]
        if (phaseTimeRef.current >= currentPhase.seconds) {
          phaseTimeRef.current = 0
          return (idx + 1) % BREATH_PHASES.length
        }
        return idx
      })
    }, 1000)
  }, [])

  useEffect(() => {
    if (duration !== null && remaining <= 0 && tickRef.current) {
      clearInterval(tickRef.current)
      tickRef.current = null
    }
  }, [remaining, duration])

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [])

  async function handleComplete() {
    if (!sessionId || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/account/tune-your-brain/sessions/${sessionId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Something went wrong")
      setFinished(true)
      if (tickRef.current) clearInterval(tickRef.current)
    } catch {
      setError("That didn't save. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  function reset() {
    setMode(null)
    setSessionId(null)
    setContentItem(null)
    setFinished(false)
    setDuration(null)
  }

  const durationOptions = contentItem?.payload?.durationOptions ?? [30, 60, 120, 180, 300]
  const noticePrompts = contentItem?.payload?.prompts ?? []

  return (
    <div className="rounded-2xl border border-navy/8 bg-white p-6">
      {error && (
        <div role="alert" className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {finished ? (
        <div role="status" aria-live="polite" className="rounded-xl bg-cream-panel border border-navy/8 p-4">
          <p className="text-sm font-bold text-navy mb-1">Nice reset.</p>
          <p className="text-sm text-ink-soft">However that went for you, taking the moment is what counts.</p>
          <button
            type="button"
            onClick={reset}
            className="mt-4 rounded-xl bg-amber px-5 py-2 text-sm font-bold text-navy-dark hover:bg-amber-dark transition-colors"
          >
            Do another
          </button>
        </div>
      ) : !mode ? (
        <>
          <p className="text-sm text-ink-soft mb-4">Pick a short exercise to reset for a minute.</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={() => chooseMode("breathing")}
              className="rounded-xl border border-navy/10 bg-white px-4 py-3 text-sm font-semibold text-navy hover:border-amber/50 hover:bg-cream-panel disabled:opacity-50"
            >
              Guided Breathing
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => chooseMode("notice")}
              className="rounded-xl border border-navy/10 bg-white px-4 py-3 text-sm font-semibold text-navy hover:border-amber/50 hover:bg-cream-panel disabled:opacity-50"
            >
              Notice Around You
            </button>
          </div>
        </>
      ) : mode === "breathing" ? (
        <>
          {duration === null ? (
            <>
              <p className="text-sm text-ink-soft mb-4">How long would you like to breathe?</p>
              <div className="flex flex-wrap gap-2">
                {durationOptions.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => startBreathing(d)}
                    className="rounded-full border border-navy/10 px-4 py-2 text-sm font-semibold text-navy hover:border-amber/50 hover:bg-cream-panel"
                  >
                    {formatSeconds(d)}
                  </button>
                ))}
              </div>
              <label className="mt-4 flex items-center gap-2 text-xs text-ink-soft">
                <input
                  type="checkbox"
                  checked={reducedMotion}
                  onChange={(e) => setReducedMotion(e.target.checked)}
                  className="rounded border-navy/20"
                />
                Reduce motion
              </label>
            </>
          ) : (
            <div className="flex flex-col items-center py-4">
              {!reducedMotion && (
                <div
                  className="mb-5 h-24 w-24 rounded-full bg-amber/30 border-2 border-amber transition-transform duration-[1000ms] ease-in-out"
                  style={{
                    transform:
                      BREATH_PHASES[phaseIndex % BREATH_PHASES.length].label === "Breathe in"
                        ? "scale(1.35)"
                        : BREATH_PHASES[phaseIndex % BREATH_PHASES.length].label === "Hold"
                          ? "scale(1.35)"
                          : "scale(0.85)",
                  }}
                  aria-hidden="true"
                />
              )}
              <p className="text-lg font-bold text-navy mb-1">
                {BREATH_PHASES[phaseIndex % BREATH_PHASES.length].label}…
              </p>
              <p className="text-sm text-ink-soft mb-5">{formatSeconds(remaining)} remaining</p>
              <button
                type="button"
                onClick={handleComplete}
                disabled={submitting}
                className="rounded-xl bg-amber px-5 py-2 text-sm font-bold text-navy-dark hover:bg-amber-dark transition-colors disabled:opacity-50"
              >
                {submitting ? "Saving…" : "I'm Finished"}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="py-2">
          {noticePrompts.length > 0 && (
            <p className="text-base font-semibold text-navy mb-6 min-h-[3rem]">
              {noticePrompts[Math.min(promptIndex, noticePrompts.length - 1)]}
            </p>
          )}
          <p className="mb-4 text-xs text-ink-soft/70">
            Step {Math.min(promptIndex, noticePrompts.length - 1) + 1} of {noticePrompts.length}
          </p>
          {promptIndex < noticePrompts.length - 1 ? (
            <button
              type="button"
              onClick={() => setPromptIndex((i) => i + 1)}
              className="rounded-xl bg-amber px-5 py-2 text-sm font-bold text-navy-dark hover:bg-amber-dark transition-colors"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleComplete}
              disabled={submitting}
              className="rounded-xl bg-amber px-5 py-2 text-sm font-bold text-navy-dark hover:bg-amber-dark transition-colors disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Finish"}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

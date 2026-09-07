import { useState } from "react"

// Client player for "kind: MISSION" (Kindness Quest) -- a genuinely
// two-step flow, not a single submit-and-see-the-answer step like the
// other games. Step 1 ("accept") is a session start via the generic
// endpoint; step 2 ("I Did It") hits Kindness Quest's own dedicated
// mark-done route. No proof is ever asked for, and there is no
// competitive/ranking UI here -- just this member's own mission.

type MoodOption = "Great" | "Good" | "Neutral" | "Interesting"
const MOOD_OPTIONS: MoodOption[] = ["Great", "Good", "Neutral", "Interesting"]

interface MissionVM {
  sessionId: string
  prompt: string
}

interface MissionGamePlayerProps {
  gameKey: string
  initialMission: MissionVM | null
}

export function MissionGamePlayer({ gameKey, initialMission }: MissionGamePlayerProps) {
  const [mission, setMission] = useState<MissionVM | null>(initialMission)
  const [loading, setLoading] = useState(false)
  const [selectedMood, setSelectedMood] = useState<MoodOption | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function acceptMission() {
    setLoading(true)
    setError(null)
    setDone(false)
    setSelectedMood(null)
    try {
      const res = await fetch("/api/account/tune-your-brain/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameKey }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Couldn't load a mission.")
      setMission({ sessionId: data.sessionId, prompt: data.contentItem.prompt })
    } catch {
      setError("Couldn't load that. Try again in a minute.")
    } finally {
      setLoading(false)
    }
  }

  async function markDone() {
    if (!mission || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/account/tune-your-brain/kindness-missions/${mission.sessionId}/mark-done`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moodAfter: selectedMood ?? undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Something went wrong")
      setDone(true)
    } catch {
      setError("That didn't save. Try again.")
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

      {done ? (
        <div role="status" aria-live="polite" className="rounded-xl bg-cream-panel border border-navy/8 p-4">
          <p className="text-sm font-bold text-navy mb-1">Nice one.</p>
          <p className="text-sm text-ink-soft">That's one more bit of kindness out in the world.</p>
          <button
            type="button"
            onClick={acceptMission}
            className="mt-4 rounded-xl bg-amber px-5 py-2 text-sm font-bold text-navy-dark hover:bg-amber-dark transition-colors"
          >
            Get another mission
          </button>
        </div>
      ) : mission ? (
        <>
          <p className="text-base font-semibold text-navy mb-5">{mission.prompt}</p>
          <p className="text-sm text-ink-soft mb-4">
            No rush, and no proof needed -- whenever you've done it, just let us know.
          </p>

          <p id="tb-mood-label" className="text-xs font-semibold uppercase tracking-widest text-amber-dark mb-2">
            How did it feel? (optional)
          </p>
          <div className="mb-5 flex flex-wrap gap-2" role="group" aria-labelledby="tb-mood-label">
            {MOOD_OPTIONS.map((mood) => (
              <button
                key={mood}
                type="button"
                aria-pressed={selectedMood === mood}
                onClick={() => setSelectedMood((m) => (m === mood ? null : mood))}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  selectedMood === mood
                    ? "border-amber bg-amber/15 text-navy"
                    : "border-navy/10 text-ink-soft hover:border-amber/50"
                }`}
              >
                {mood}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={markDone}
            disabled={submitting}
            className="rounded-xl bg-amber px-5 py-2 text-sm font-bold text-navy-dark hover:bg-amber-dark transition-colors disabled:opacity-50"
          >
            {submitting ? "Saving…" : "I Did It"}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-soft mb-4">
            Accept a small kindness mission, do it whenever works for you, then come back and mark it done.
          </p>
          <button
            type="button"
            onClick={acceptMission}
            disabled={loading}
            className="rounded-xl bg-amber px-5 py-2 text-sm font-bold text-navy-dark hover:bg-amber-dark transition-colors disabled:opacity-50"
          >
            {loading ? "Loading…" : "Get a Mission"}
          </button>
        </>
      )}
    </div>
  )
}

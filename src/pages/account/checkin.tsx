import type { NextPageWithLayout } from "@/types/next"
import type { GetServerSideProps } from "next"
import Head from "next/head"
import { useState, useEffect } from "react"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { SiteLayout } from "@/components/layout/SiteLayout"
import { AccountNav } from "@/components/account/AccountNav"

interface CheckInRow {
  id: string
  date: string
  mood: number
  energy: number
  note: string | null
}

interface Props {
  userId: string
}

const MOOD_EMOJIS: Record<number, string> = {
  1: "😞",
  2: "😕",
  3: "😐",
  4: "🙂",
  5: "😊",
}

const MOOD_LABELS: Record<number, string> = {
  1: "Rough",
  2: "Meh",
  3: "Okay",
  4: "Good",
  5: "Great",
}

const ENERGY_LABELS: Record<number, string> = {
  1: "Drained",
  2: "Low",
  3: "Steady",
  4: "Energized",
  5: "Fired up",
}

function DotRow({ history }: { history: CheckInRow[] }) {
  // Show last 7 days in order oldest → newest
  const last7 = [...history].reverse().slice(-7)
  return (
    <div className="flex items-center gap-2">
      {last7.map((ci) => {
        const color =
          ci.mood >= 4 ? "bg-green-400" : ci.mood === 3 ? "bg-amber" : "bg-red-400"
        return (
          <div
            key={ci.date}
            title={`${new Date(ci.date).toLocaleDateString()} — mood ${ci.mood}`}
            className={`h-3 w-3 rounded-full ${color}`}
          />
        )
      })}
    </div>
  )
}

const DailyCheckInPage: NextPageWithLayout<Props> = () => {
  const [mood, setMood] = useState(3)
  const [energy, setEnergy] = useState(3)
  const [note, setNote] = useState("")
  const [todayCheckIn, setTodayCheckIn] = useState<CheckInRow | null>(null)
  const [history, setHistory] = useState<CheckInRow[]>([])
  const [streak, setStreak] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const [todayRes, histRes] = await Promise.all([
        fetch("/api/account/checkin"),
        fetch("/api/account/checkin/history"),
      ])
      const todayData = await todayRes.json()
      const histData = await histRes.json()

      if (todayData.checkIn) {
        setTodayCheckIn(todayData.checkIn)
        setMood(todayData.checkIn.mood)
        setEnergy(todayData.checkIn.energy)
        setNote(todayData.checkIn.note ?? "")
      }
      setHistory(histData.checkIns ?? [])
      setStreak(histData.streak ?? 0)
      setLoading(false)
    }
    load()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch("/api/account/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood, energy, note: note || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Something went wrong")
      setTodayCheckIn(data.checkIn)
      // Refresh streak
      const histRes = await fetch("/api/account/checkin/history")
      const histData = await histRes.json()
      setHistory(histData.checkIns ?? [])
      setStreak(histData.streak ?? 0)
      setToast(todayCheckIn ? "Check-in updated." : "Checked in — nice work!")
      setTimeout(() => setToast(null), 3000)
    } catch {
      setToast("Couldn't save. Give it another try.")
      setTimeout(() => setToast(null), 3000)
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    if (!todayCheckIn) return
    setRemoving(true)
    try {
      const res = await fetch(`/api/account/checkin/${todayCheckIn.id}`, { method: "DELETE" })
      if (res.ok || res.status === 204) {
        setTodayCheckIn(null)
        setMood(3)
        setEnergy(3)
        setNote("")
        // Refresh history
        const histRes = await fetch("/api/account/checkin/history")
        const histData = await histRes.json()
        setHistory(histData.checkIns ?? [])
        setStreak(histData.streak ?? 0)
        setToast("Entry removed.")
        setTimeout(() => setToast(null), 3000)
      }
    } catch {
      setToast("Couldn't remove. Try again.")
      setTimeout(() => setToast(null), 3000)
    } finally {
      setRemoving(false)
    }
  }

  const last7 = history.slice(0, 7)

  return (
    <>
      <Head><title>Daily Check-In — Fixer Nation</title></Head>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <AccountNav />

        {toast && (
          <div className="mt-4 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm font-medium text-green-800">
            {toast}
          </div>
        )}

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h1 className="text-2xl font-extrabold text-navy">Daily Check-In</h1>
            {streak > 0 && (
              <span className="rounded-full bg-amber/20 px-3 py-1 text-sm font-bold text-amber-dark">
                🔥 {streak} day streak
              </span>
            )}
          </div>
          <p className="text-sm text-ink-soft mb-6">
            A quick pulse on how you&apos;re doing — takes 30 seconds and earns you 5 points.
          </p>

          {last7.length > 0 && (
            <div className="mb-6 flex items-center gap-3">
              <span className="text-xs font-semibold text-ink-soft uppercase tracking-wide">Last 7 days</span>
              <DotRow history={last7} />
            </div>
          )}

          {loading ? (
            <div className="rounded-2xl border border-navy/8 bg-white p-8 text-center text-sm text-ink-soft">
              Loading...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="rounded-2xl border border-navy/8 bg-white p-6 space-y-6">
              {/* Mood */}
              <div>
                <label className="block text-sm font-bold text-navy mb-3">
                  How are you feeling? <span className="text-2xl ml-1">{MOOD_EMOJIS[mood]}</span>
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setMood(v)}
                      className={`flex-1 rounded-xl border py-3 text-xl transition-all ${
                        mood === v
                          ? "border-amber bg-amber/10 shadow-sm"
                          : "border-navy/10 hover:border-amber/50 hover:bg-cream-panel"
                      }`}
                      title={MOOD_LABELS[v]}
                    >
                      {MOOD_EMOJIS[v]}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-ink-soft text-center">{MOOD_LABELS[mood]}</p>
              </div>

              {/* Energy */}
              <div>
                <label className="block text-sm font-bold text-navy mb-3">
                  Energy level
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setEnergy(v)}
                      className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-all ${
                        energy === v
                          ? "border-amber bg-amber/10 text-navy shadow-sm"
                          : "border-navy/10 text-ink-soft hover:border-amber/50 hover:bg-cream-panel"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-ink-soft text-center">{ENERGY_LABELS[energy]}</p>
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm font-bold text-navy mb-1.5">
                  Anything on your mind? <span className="font-normal text-ink-soft">(optional)</span>
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="A win, a struggle, something you noticed..."
                  className="w-full rounded-xl border border-navy/15 bg-white px-4 py-3 text-sm text-ink placeholder-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-amber/40 resize-none"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-4">
                  {todayCheckIn ? (
                    <p className="text-xs text-ink-soft">Already checked in today — you can update below.</p>
                  ) : (
                    <p className="text-xs text-ink-soft">+5 pts awarded on your first check-in each day.</p>
                  )}
                  {todayCheckIn && (
                    <button
                      type="button"
                      onClick={handleRemove}
                      disabled={removing}
                      className="text-xs text-red-500 underline underline-offset-2 hover:text-red-700 disabled:opacity-50"
                    >
                      {removing ? "Removing…" : "Remove today's entry"}
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-amber px-6 py-2.5 text-sm font-bold text-navy-dark hover:bg-amber-dark disabled:opacity-60 transition-colors"
                >
                  {saving ? "Saving..." : todayCheckIn ? "Update" : "Check In"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  )
}

DailyCheckInPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions)
  if (!session) return { redirect: { destination: "/signin?callbackUrl=/account/checkin", permanent: false } }

  return { props: { userId: session.user.id } }
}

export default DailyCheckInPage

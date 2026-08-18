import Head from "next/head"
import { AccountNav } from "@/components/account/AccountNav"
import { useState } from "react"
import { GetServerSideProps } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { SiteLayout } from "@/components/layout/SiteLayout"
import type { NextPageWithLayout } from "@/types/next"

type FocusDb = {
  focusArea: {
    findMany: (args?: { where?: object; orderBy?: object }) => Promise<FocusAreaRow[]>
  }
  memberFocusArea: {
    findMany: (args?: { where?: object; include?: object }) => Promise<MemberFocusAreaRow[]>
  }
  memberPreference: {
    findUnique: (args: { where: object }) => Promise<PreferenceRow | null>
  }
}

type FocusAreaRow = {
  id: string
  name: string
  order: number
}

type MemberFocusAreaRow = {
  id: string
  focusAreaId: string
  isPrimary: boolean
}

type PreferenceRow = {
  contentDepth: string
  contentFormats: string[]
  reminderEnabled: boolean
  reminderTime: string | null
}

interface Props {
  allAreas: FocusAreaRow[]
  myAreas: MemberFocusAreaRow[]
  preferences: PreferenceRow | null
}

const CONTENT_FORMATS = [
  { value: "text", label: "Articles & guides" },
  { value: "audio", label: "Audio" },
  { value: "video", label: "Video" },
  { value: "reflection", label: "Reflection prompts" },
  { value: "challenge", label: "Challenges" },
]

const DEPTH_OPTIONS = [
  { value: "QUICK", label: "Quick hit", desc: "2–3 minutes" },
  { value: "SHORT", label: "Short read", desc: "5–10 minutes" },
  { value: "DEEPER", label: "Go deeper", desc: "10–20 minutes" },
]

const FocusPage: NextPageWithLayout<Props> = ({ allAreas, myAreas, preferences }) => {
  // Focus area state
  const initialPrimary = myAreas.find((a) => a.isPrimary)?.focusAreaId ?? null
  const initialSecondary = myAreas.filter((a) => !a.isPrimary).map((a) => a.focusAreaId)

  const [primaryId, setPrimaryId] = useState<string | null>(initialPrimary)
  const [secondaryIds, setSecondaryIds] = useState<string[]>(initialSecondary)

  // Preference state
  const [contentDepth, setContentDepth] = useState<string>(preferences?.contentDepth ?? "SHORT")
  const [contentFormats, setContentFormats] = useState<string[]>(
    preferences?.contentFormats ?? ["text"]
  )
  const [reminderEnabled, setReminderEnabled] = useState<boolean>(
    preferences?.reminderEnabled ?? true
  )
  const [reminderTime, setReminderTime] = useState<string>(preferences?.reminderTime ?? "08:00")

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function toggleSecondary(id: string) {
    if (id === primaryId) return // can't select primary as secondary
    setSecondaryIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 2) return prev // max 2 secondary
      return [...prev, id]
    })
  }

  function toggleFormat(val: string) {
    setContentFormats((prev) =>
      prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]
    )
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)

    const focusAreas = [
      ...(primaryId ? [{ focusAreaId: primaryId, isPrimary: true }] : []),
      ...secondaryIds.map((id) => ({ focusAreaId: id, isPrimary: false })),
    ]

    const res = await fetch("/api/account/focus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        focusAreas,
        preferences: {
          contentDepth,
          contentFormats,
          reminderEnabled,
          reminderTime: reminderEnabled ? reminderTime : null,
        },
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(
        typeof data.error === "string"
          ? data.error
          : data.error?.formErrors?.[0] ?? "Something went wrong. Try again."
      )
    } else {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    }
    setSaving(false)
  }

  return (
    <>
      <Head>
        <title>Focus &amp; Goals — Fixer Nation</title>
      </Head>

      <section className="px-6 py-14 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <AccountNav />
          <h1 className="text-3xl font-extrabold tracking-tight text-navy">Focus &amp; Goals</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Tell us what you're working on so we can surface the most relevant content and
            experiences for you.
          </p>

          <form onSubmit={handleSave} className="mt-10 space-y-10">

            {/* Section 1: Focus areas */}
            <div>
              <h2 className="text-base font-extrabold text-navy">Your focus areas</h2>
              <p className="mt-1 text-sm text-ink-soft">
                Pick your main focus, then add up to two more if you're working on multiple things.
              </p>

              {/* Primary */}
              <div className="mt-5">
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-amber-dark">
                  Main focus — pick one
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {allAreas.map((area) => {
                    const selected = primaryId === area.id
                    return (
                      <button
                        key={area.id}
                        type="button"
                        onClick={() => {
                          setPrimaryId(area.id)
                          // If this was a secondary, remove it
                          setSecondaryIds((prev) => prev.filter((id) => id !== area.id))
                        }}
                        className={[
                          "rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition-colors",
                          selected
                            ? "border-navy bg-navy text-white"
                            : "border-navy/15 bg-white text-ink hover:border-navy/30 hover:bg-cream-panel",
                        ].join(" ")}
                      >
                        {area.name}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Secondary */}
              <div className="mt-6">
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-ink-soft">
                  Also working on — up to two more
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {allAreas
                    .filter((a) => a.id !== primaryId)
                    .map((area) => {
                      const selected = secondaryIds.includes(area.id)
                      const atMax = secondaryIds.length >= 2 && !selected
                      return (
                        <button
                          key={area.id}
                          type="button"
                          onClick={() => toggleSecondary(area.id)}
                          disabled={atMax}
                          className={[
                            "rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition-colors",
                            selected
                              ? "border-amber bg-amber/15 text-navy"
                              : atMax
                              ? "border-navy/8 bg-white text-ink-soft opacity-50 cursor-not-allowed"
                              : "border-navy/15 bg-white text-ink hover:border-navy/30 hover:bg-cream-panel",
                          ].join(" ")}
                        >
                          {area.name}
                        </button>
                      )
                    })}
                </div>
              </div>
            </div>

            {/* Section 2: Preferences */}
            <div>
              <h2 className="text-base font-extrabold text-navy">How you like to learn</h2>
              <p className="mt-1 text-sm text-ink-soft">
                We'll use these to personalise the content we show you.
              </p>

              {/* Content depth */}
              <div className="mt-5">
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-ink-soft">
                  Preferred depth
                </p>
                <div className="flex flex-wrap gap-2">
                  {DEPTH_OPTIONS.map((opt) => {
                    const selected = contentDepth === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setContentDepth(opt.value)}
                        className={[
                          "rounded-xl border px-4 py-2.5 text-left transition-colors",
                          selected
                            ? "border-navy bg-navy text-white"
                            : "border-navy/15 bg-white text-ink hover:border-navy/30 hover:bg-cream-panel",
                        ].join(" ")}
                      >
                        <span className="block text-sm font-bold">{opt.label}</span>
                        <span className={`block text-xs ${selected ? "text-white/70" : "text-ink-soft"}`}>
                          {opt.desc}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Content formats */}
              <div className="mt-6">
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-ink-soft">
                  Formats you enjoy
                </p>
                <div className="flex flex-wrap gap-2">
                  {CONTENT_FORMATS.map((fmt) => {
                    const selected = contentFormats.includes(fmt.value)
                    return (
                      <button
                        key={fmt.value}
                        type="button"
                        onClick={() => toggleFormat(fmt.value)}
                        className={[
                          "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                          selected
                            ? "border-amber bg-amber/15 text-navy"
                            : "border-navy/15 bg-white text-ink hover:border-navy/30 hover:bg-cream-panel",
                        ].join(" ")}
                      >
                        {fmt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Reminder */}
              <div className="mt-6">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={reminderEnabled}
                    onClick={() => setReminderEnabled((v) => !v)}
                    className={[
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                      reminderEnabled ? "bg-navy" : "bg-navy/20",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
                        reminderEnabled ? "translate-x-5" : "translate-x-0",
                      ].join(" ")}
                    />
                  </button>
                  <span className="text-sm font-semibold text-navy">Daily reminder</span>
                </div>
                {reminderEnabled && (
                  <div className="mt-3 flex items-center gap-3">
                    <label className="text-sm text-ink-soft">Remind me at</label>
                    <input
                      type="time"
                      value={reminderTime}
                      onChange={(e) => setReminderTime(e.target.value)}
                      className="rounded-lg border border-navy/15 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                    />
                  </div>
                )}
              </div>
            </div>

            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                {error}
              </p>
            )}
            {success && (
              <p className="rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
                Saved — your focus and preferences are updated.
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="rounded-[10px] bg-navy px-6 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_-10px_rgba(20,40,56,0.4)] hover:bg-navy-dark disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : "Save focus & preferences"}
            </button>
          </form>
        </div>
      </section>
    </>
  )
}

FocusPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>
export default FocusPage

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions)
  if (!session) {
    return {
      redirect: {
        destination: `/signin?callbackUrl=${encodeURIComponent("/account/focus")}`,
        permanent: false,
      },
    }
  }

  const db_ = db as never as FocusDb
  const [allAreas, myAreas, preferences] = await Promise.all([
    db_.focusArea.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
    }),
    db_.memberFocusArea.findMany({ where: { userId: session.user.id } }),
    db_.memberPreference.findUnique({ where: { userId: session.user.id } }),
  ])

  return {
    props: {
      allAreas: JSON.parse(JSON.stringify(allAreas)),
      myAreas: JSON.parse(JSON.stringify(myAreas)),
      preferences: preferences ? JSON.parse(JSON.stringify(preferences)) : null,
    },
  }
}

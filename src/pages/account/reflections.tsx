import type { NextPageWithLayout } from "@/types/next"
import type { GetServerSideProps } from "next"
import Head from "next/head"
import Link from "next/link"
import { useState } from "react"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { SiteLayout } from "@/components/layout/SiteLayout"
import { AccountNav } from "@/components/account/AccountNav"

interface ReflectionEntry {
  id: string
  title: string | null
  body: string
  mood: number | null
  isPrivate: boolean
  focusAreaId: string | null
  tags: string[]
  createdAt: string
  updatedAt: string
}

interface Props {
  initialEntries: ReflectionEntry[]
}

const MOOD_EMOJIS: Record<number, string> = {
  1: "😞",
  2: "😕",
  3: "😐",
  4: "🙂",
  5: "😊",
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
}

interface EntryFormProps {
  initial?: Partial<ReflectionEntry>
  onSave: (entry: ReflectionEntry) => void
  onCancel: () => void
  editId?: string
}

function EntryForm({ initial, onSave, onCancel, editId }: EntryFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "")
  const [body, setBody] = useState(initial?.body ?? "")
  const [mood, setMood] = useState<number | null>(initial?.mood ?? null)
  const [tagsRaw, setTagsRaw] = useState((initial?.tags ?? []).join(", "))
  const [focusAreaId, setFocusAreaId] = useState(initial?.focusAreaId ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (body.trim().length < 10) {
      setError("Write at least 10 characters to save an entry.")
      return
    }
    setSaving(true)
    setError(null)

    const payload = {
      title: title.trim() || undefined,
      body: body.trim(),
      mood: mood ?? undefined,
      tags: parseTags(tagsRaw),
      focusAreaId: focusAreaId.trim() || undefined,
    }

    try {
      const res = editId
        ? await fetch(`/api/account/reflections/${editId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/account/reflections", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })

      const data = await res.json()
      if (!res.ok) {
        setError(
          typeof data.error === "string" ? data.error : "Something went wrong. Give it another try."
        )
        return
      }
      onSave(data.entry)
    } catch {
      setError("Something went wrong. Give it another try.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-navy/8 bg-white p-5 space-y-4 mb-6"
    >
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-bold text-navy mb-1.5">
          Give it a title (or don&apos;t)
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={255}
          placeholder="Optional title..."
          className="w-full rounded-xl border border-navy/15 bg-white px-4 py-2.5 text-sm text-ink placeholder-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-amber/40"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-navy mb-1.5">
          What&apos;s on your mind?
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          minLength={10}
          placeholder="Write anything. This is just for you."
          rows={5}
          style={{ minHeight: 120 }}
          className="w-full rounded-xl border border-navy/15 bg-white px-4 py-3 text-sm text-ink placeholder-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-amber/40 resize-y"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-navy mb-2">
          How are you feeling? (optional)
        </label>
        <div className="flex gap-2">
          {([1, 2, 3, 4, 5] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setMood(mood === n ? null : n)}
              className={`text-2xl rounded-xl px-3 py-2 transition-colors ${
                mood === n
                  ? "bg-amber/20 ring-2 ring-amber"
                  : "bg-navy/5 hover:bg-navy/10"
              }`}
              aria-label={`Mood ${n}`}
            >
              {MOOD_EMOJIS[n]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-navy mb-1.5">
          Tags, separated by commas
        </label>
        <input
          type="text"
          value={tagsRaw}
          onChange={(e) => setTagsRaw(e.target.value)}
          placeholder="e.g. mindset, work, gratitude"
          className="w-full rounded-xl border border-navy/15 bg-white px-4 py-2.5 text-sm text-ink placeholder-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-amber/40"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-navy mb-1.5">
          Focus area (optional)
        </label>
        <input
          type="text"
          value={focusAreaId}
          onChange={(e) => setFocusAreaId(e.target.value)}
          placeholder="Focus area ID"
          className="w-full rounded-xl border border-navy/15 bg-white px-4 py-2.5 text-sm text-ink placeholder-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-amber/40"
        />
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl px-5 py-2.5 text-sm font-semibold text-ink-soft border border-navy/15 hover:bg-navy/5 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-amber px-6 py-2.5 text-sm font-bold text-navy-dark hover:bg-amber-dark disabled:opacity-60 transition-colors"
        >
          {saving ? "Saving..." : "Save entry"}
        </button>
      </div>
    </form>
  )
}

const ReflectionsPage: NextPageWithLayout<Props> = ({ initialEntries }) => {
  const [entries, setEntries] = useState<ReflectionEntry[]>(initialEntries)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null)

  function showToast(ok: boolean, text: string) {
    setToast({ ok, text })
    setTimeout(() => setToast(null), 3500)
  }

  function handleCreated(entry: ReflectionEntry) {
    setEntries((prev) => [entry, ...prev])
    setShowForm(false)
    showToast(true, "Entry saved.")
  }

  function handleUpdated(entry: ReflectionEntry) {
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? entry : e)))
    setEditingId(null)
    showToast(true, "Entry saved.")
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this entry? This can't be undone.")) return
    try {
      const res = await fetch(`/api/account/reflections/${id}`, { method: "DELETE" })
      if (!res.ok) {
        showToast(false, "Something went wrong. Give it another try.")
        return
      }
      setEntries((prev) => prev.filter((e) => e.id !== id))
      showToast(true, "Entry deleted.")
    } catch {
      showToast(false, "Something went wrong. Give it another try.")
    }
  }

  const editingEntry = editingId ? entries.find((e) => e.id === editingId) : null

  return (
    <>
      <Head><title>My Reflections — Fixer Nation</title></Head>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <AccountNav />

        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-extrabold text-navy">My Reflections</h1>
            {!showForm && editingId === null && (
              <button
                onClick={() => setShowForm(true)}
                className="rounded-xl bg-amber px-5 py-2 text-sm font-bold text-navy-dark hover:bg-amber-dark transition-colors"
              >
                New entry
              </button>
            )}
          </div>

          <p className="text-sm text-ink-soft mb-6">
            This space is yours alone. Nothing you write here is visible to anyone else.
          </p>

          {toast && (
            <div
              className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium ${
                toast.ok
                  ? "bg-green-50 border border-green-200 text-green-800"
                  : "bg-red-50 border border-red-200 text-red-800"
              }`}
            >
              {toast.text}
            </div>
          )}

          {showForm && (
            <EntryForm
              onSave={handleCreated}
              onCancel={() => setShowForm(false)}
            />
          )}

          {entries.length === 0 && !showForm ? (
            <div className="rounded-2xl border border-navy/8 bg-white p-10 text-center">
              <p className="text-sm text-ink-soft">
                Nothing here yet. Start writing — it stays between you and the page.
              </p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 rounded-xl bg-amber px-6 py-2.5 text-sm font-bold text-navy-dark hover:bg-amber-dark transition-colors"
              >
                New entry
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {entries.map((entry) => (
                <div key={entry.id}>
                  {editingId === entry.id && editingEntry ? (
                    <EntryForm
                      initial={editingEntry}
                      editId={entry.id}
                      onSave={handleUpdated}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <div className="rounded-2xl border border-navy/8 bg-white p-5">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-navy leading-snug">
                            {entry.title ?? entry.body.slice(0, 80) + (entry.body.length > 80 ? "..." : "")}
                          </p>
                          <p className="text-xs text-ink-soft/70 mt-0.5">
                            {formatDate(entry.createdAt)}
                            {entry.mood && (
                              <span className="ml-2">{MOOD_EMOJIS[entry.mood]}</span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => {
                              setEditingId(entry.id)
                              setShowForm(false)
                            }}
                            className="text-xs font-semibold text-ink-soft hover:text-navy transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="text-xs font-semibold text-red-500 hover:text-red-700 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {entry.title && (
                        <p className="text-sm text-ink leading-relaxed line-clamp-3 mb-3">
                          {entry.body}
                        </p>
                      )}

                      {entry.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {entry.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center rounded-full bg-amber/10 px-2.5 py-0.5 text-xs font-medium text-amber-dark"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 text-center">
            <Link href="/account" className="text-sm font-semibold text-amber hover:underline">
              Back to account
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}

ReflectionsPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions)
  if (!session) {
    return { redirect: { destination: "/signin?callbackUrl=/account/reflections", permanent: false } }
  }

  // Fetch initial entries server-side using the cast pattern (new model)
  const { db } = await import("@/lib/db")

  type ReflectionRow = {
    id: string
    userId: string
    title: string | null
    body: string
    mood: number | null
    isPrivate: boolean
    focusAreaId: string | null
    tags: string[]
    createdAt: Date
    updatedAt: Date
  }

  type ReflectionDb = {
    reflectionEntry: {
      findMany: (args?: Record<string, unknown>) => Promise<ReflectionRow[]>
    }
  }

  const db_ = db as never as ReflectionDb

  const entries = await db_.reflectionEntry.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  })

  return {
    props: {
      initialEntries: JSON.parse(JSON.stringify(entries)),
    },
  }
}

export default ReflectionsPage

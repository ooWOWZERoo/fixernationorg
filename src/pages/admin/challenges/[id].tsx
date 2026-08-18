import type { NextPageWithLayout } from "@/types/next"
import type { GetServerSideProps } from "next"
import { useState } from "react"
import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { AdminLayout } from "@/components/layout/AdminLayout"

type ChallengesDb = {
  challenge: {
    findUnique: (args: any) => Promise<any | null>
  }
}

interface Step {
  id: string
  day: number
  title: string
  description: string | null
  actionPrompt: string | null
  reflectionPrompt: string | null
  order: number
}

interface Challenge {
  id: string
  title: string
  slug: string
  description: string
  summary: string
  focusAreaIds: string[]
  durationDays: number
  active: boolean
  startMode: string
  startDate: string | null
  enrollmentLimit: number | null
  loyaltyPoints: number
  createdAt: string
  updatedAt: string
  steps: Step[]
  _count: { enrollments: number }
}

interface Props {
  challenge: Challenge
}

const AdminChallengeDetailPage: NextPageWithLayout<Props> = ({ challenge: initialChallenge }) => {
  const [challenge, setChallenge] = useState(initialChallenge)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const [showAddStep, setShowAddStep] = useState(false)
  const [stepForm, setStepForm] = useState({
    day: "1",
    title: "",
    description: "",
    actionPrompt: "",
    reflectionPrompt: "",
    order: "0",
  })
  const [addingStep, setAddingStep] = useState(false)
  const [stepError, setStepError] = useState<string | null>(null)

  const [editingStepId, setEditingStepId] = useState<string | null>(null)
  const [editStepForm, setEditStepForm] = useState<Partial<Step>>({})

  function setField(field: string, value: unknown) {
    setChallenge((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      const res = await fetch(`/api/admin/challenges/${challenge.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: challenge.title,
          description: challenge.description,
          summary: challenge.summary,
          focusAreaIds: challenge.focusAreaIds,
          durationDays: challenge.durationDays,
          active: challenge.active,
          startMode: challenge.startMode,
          startDate: challenge.startDate || null,
          enrollmentLimit: challenge.enrollmentLimit,
          loyaltyPoints: challenge.loyaltyPoints,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setSaveError(data.error ?? "Failed to save.")
        return
      }
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch {
      setSaveError("Network error.")
    } finally {
      setSaving(false)
    }
  }

  async function handleAddStep(e: React.FormEvent) {
    e.preventDefault()
    setAddingStep(true)
    setStepError(null)
    try {
      const res = await fetch(`/api/admin/challenges/${challenge.id}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          day: parseInt(stepForm.day, 10) || 1,
          title: stepForm.title,
          description: stepForm.description || undefined,
          actionPrompt: stepForm.actionPrompt || undefined,
          reflectionPrompt: stepForm.reflectionPrompt || undefined,
          order: parseInt(stepForm.order, 10) || 0,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setStepError(data.error ?? "Failed to add step.")
        return
      }
      setChallenge((prev) => ({
        ...prev,
        steps: [...prev.steps, data].sort((a, b) => a.day - b.day || a.order - b.order),
      }))
      setStepForm({ day: "1", title: "", description: "", actionPrompt: "", reflectionPrompt: "", order: "0" })
      setShowAddStep(false)
    } catch {
      setStepError("Network error.")
    } finally {
      setAddingStep(false)
    }
  }

  async function handleUpdateStep(stepId: string) {
    try {
      const res = await fetch(`/api/admin/challenges/steps/${stepId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editStepForm),
      })
      const data = await res.json()
      if (!res.ok) return
      setChallenge((prev) => ({
        ...prev,
        steps: prev.steps
          .map((s) => (s.id === stepId ? { ...s, ...data } : s))
          .sort((a, b) => a.day - b.day || a.order - b.order),
      }))
      setEditingStepId(null)
    } catch {
      // silent
    }
  }

  async function handleDeleteStep(stepId: string) {
    if (!confirm("Delete this step? Completion records for this step will be preserved.")) return
    try {
      const res = await fetch(`/api/admin/challenges/steps/${stepId}`, { method: "DELETE" })
      if (res.ok || res.status === 204) {
        setChallenge((prev) => ({
          ...prev,
          steps: prev.steps.filter((s) => s.id !== stepId),
        }))
      }
    } catch {
      // silent
    }
  }

  // Group steps by day for display
  const stepsByDay = challenge.steps.reduce<Record<number, Step[]>>((acc, step) => {
    if (!acc[step.day]) acc[step.day] = []
    acc[step.day].push(step)
    return acc
  }, {})
  const days = Object.keys(stepsByDay).map(Number).sort((a, b) => a - b)

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin/challenges" className="text-sm text-ink-soft hover:text-navy no-underline">
          ← Challenges
        </Link>
        <span className="text-ink-soft/40">/</span>
        <span className="text-sm font-semibold text-navy">{initialChallenge.title}</span>
      </div>

      <div className="mb-6 flex items-start justify-between">
        <h1 className="text-2xl font-extrabold text-navy">{challenge.title}</h1>
        <span className="mt-1 text-xs text-ink-soft">{challenge._count.enrollments} enrolled</span>
      </div>

      <form onSubmit={handleSave} className="space-y-5 mb-8">
        <div className="rounded-2xl border border-navy/8 bg-white p-6 space-y-5">
          <h2 className="text-base font-bold text-navy">Challenge settings</h2>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-navy">Title</label>
            <input
              type="text"
              value={challenge.title}
              onChange={(e) => setField("title", e.target.value)}
              required
              className="w-full rounded-xl border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-navy">Summary</label>
            <input
              type="text"
              value={challenge.summary}
              onChange={(e) => setField("summary", e.target.value)}
              required
              className="w-full rounded-xl border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-navy">Description</label>
            <textarea
              value={challenge.description}
              onChange={(e) => setField("description", e.target.value)}
              required
              rows={4}
              className="w-full rounded-xl border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-navy">Duration (days)</label>
              <input
                type="number"
                value={challenge.durationDays}
                onChange={(e) => setField("durationDays", parseInt(e.target.value, 10) || 30)}
                min={1}
                className="w-full rounded-xl border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-navy">Loyalty points on completion</label>
              <input
                type="number"
                value={challenge.loyaltyPoints}
                onChange={(e) => setField("loyaltyPoints", parseInt(e.target.value, 10) || 0)}
                min={0}
                className="w-full rounded-xl border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-navy">Start mode</label>
              <select
                value={challenge.startMode}
                onChange={(e) => setField("startMode", e.target.value)}
                className="w-full rounded-xl border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              >
                <option value="EVERGREEN">Evergreen (join anytime)</option>
                <option value="SCHEDULED">Scheduled (fixed start date)</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-navy">
                Enrollment limit <span className="font-normal text-ink-soft">(optional)</span>
              </label>
              <input
                type="number"
                value={challenge.enrollmentLimit ?? ""}
                onChange={(e) => setField("enrollmentLimit", e.target.value ? parseInt(e.target.value, 10) : null)}
                min={1}
                placeholder="No limit"
                className="w-full rounded-xl border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              />
            </div>
          </div>

          {challenge.startMode === "SCHEDULED" && (
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-navy">Start date</label>
              <input
                type="datetime-local"
                value={challenge.startDate ? challenge.startDate.slice(0, 16) : ""}
                onChange={(e) => setField("startDate", e.target.value ? new Date(e.target.value).toISOString() : null)}
                className="w-full rounded-xl border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              />
            </div>
          )}

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active"
                checked={challenge.active}
                onChange={(e) => setField("active", e.target.checked)}
                className="h-4 w-4 rounded border-navy/30 accent-navy"
              />
              <label htmlFor="active" className="text-sm font-medium text-navy">Active</label>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-navy">
              Slug <span className="font-normal text-ink-soft">(read-only)</span>
            </label>
            <input
              type="text"
              value={challenge.slug}
              readOnly
              className="w-full rounded-xl border border-navy/8 bg-cream-panel px-3 py-2 text-sm text-ink-soft"
            />
          </div>
        </div>

        {saveError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</div>
        )}
        {saveSuccess && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">Saved.</div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-amber px-5 py-2.5 text-sm font-bold text-navy-dark hover:bg-amber-dark disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </form>

      {/* Steps section */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-navy">Steps ({challenge.steps.length})</h2>
        <button
          onClick={() => setShowAddStep(true)}
          className="rounded-xl bg-amber px-4 py-2 text-sm font-bold text-navy-dark hover:bg-amber-dark"
        >
          + Add step
        </button>
      </div>

      {challenge.steps.length === 0 && !showAddStep && (
        <div className="rounded-2xl border border-navy/8 bg-white p-8 text-center mb-4">
          <p className="text-sm text-ink-soft">No steps yet. Add the first step to build this challenge.</p>
        </div>
      )}

      <div className="space-y-4 mb-4">
        {days.map((day) => (
          <div key={day}>
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-amber/20 px-3 py-1 text-xs font-bold text-amber-dark">
                Day {day}
              </span>
            </div>
            <div className="space-y-2 ml-2">
              {stepsByDay[day].map((step) => (
                <div key={step.id} className="rounded-2xl border border-navy/8 bg-white p-4">
                  {editingStepId === step.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-navy">Title</label>
                          <input
                            type="text"
                            value={editStepForm.title ?? step.title}
                            onChange={(e) => setEditStepForm((f) => ({ ...f, title: e.target.value }))}
                            className="w-full rounded-lg border border-navy/15 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-navy">Day</label>
                          <input
                            type="number"
                            value={editStepForm.day ?? step.day}
                            onChange={(e) => setEditStepForm((f) => ({ ...f, day: parseInt(e.target.value, 10) || 1 }))}
                            min={1}
                            className="w-full rounded-lg border border-navy/15 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-navy">Action prompt</label>
                        <textarea
                          value={editStepForm.actionPrompt ?? step.actionPrompt ?? ""}
                          onChange={(e) => setEditStepForm((f) => ({ ...f, actionPrompt: e.target.value }))}
                          rows={2}
                          placeholder="What should the member do?"
                          className="w-full rounded-lg border border-navy/15 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-navy">Reflection prompt</label>
                        <textarea
                          value={editStepForm.reflectionPrompt ?? step.reflectionPrompt ?? ""}
                          onChange={(e) => setEditStepForm((f) => ({ ...f, reflectionPrompt: e.target.value }))}
                          rows={2}
                          placeholder="Optional reflection question"
                          className="w-full rounded-lg border border-navy/15 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateStep(step.id)}
                          className="rounded-lg bg-amber px-3 py-1.5 text-xs font-bold text-navy-dark hover:bg-amber-dark"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => { setEditingStepId(null); setEditStepForm({}) }}
                          className="rounded-lg border border-navy/15 px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-cream-panel"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-4">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy/8 text-xs font-bold text-navy">
                        {step.order + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-navy text-sm">{step.title}</span>
                        {step.actionPrompt && (
                          <p className="mt-1 text-xs text-ink-soft line-clamp-2">{step.actionPrompt}</p>
                        )}
                        {step.reflectionPrompt && (
                          <p className="mt-0.5 text-xs text-ink-soft italic line-clamp-1">Reflect: {step.reflectionPrompt}</p>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => { setEditingStepId(step.id); setEditStepForm({}) }}
                          className="text-xs font-semibold text-navy hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteStep(step.id)}
                          className="text-xs font-semibold text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showAddStep && (
        <form onSubmit={handleAddStep} className="rounded-2xl border border-amber/40 bg-amber/5 p-5 space-y-4 mb-4">
          <h3 className="text-sm font-bold text-navy">New step</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-navy">Day</label>
              <input
                type="number"
                value={stepForm.day}
                onChange={(e) => setStepForm((f) => ({ ...f, day: e.target.value }))}
                required
                min={1}
                className="w-full rounded-lg border border-navy/15 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-semibold text-navy">Title</label>
              <input
                type="text"
                value={stepForm.title}
                onChange={(e) => setStepForm((f) => ({ ...f, title: e.target.value }))}
                required
                className="w-full rounded-lg border border-navy/15 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-navy">Action prompt</label>
            <textarea
              value={stepForm.actionPrompt}
              onChange={(e) => setStepForm((f) => ({ ...f, actionPrompt: e.target.value }))}
              rows={2}
              placeholder="What should the member do on this day?"
              className="w-full rounded-lg border border-navy/15 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-navy">
              Reflection prompt <span className="font-normal text-ink-soft">(optional)</span>
            </label>
            <textarea
              value={stepForm.reflectionPrompt}
              onChange={(e) => setStepForm((f) => ({ ...f, reflectionPrompt: e.target.value }))}
              rows={2}
              placeholder="Optional question for member reflection"
              className="w-full rounded-lg border border-navy/15 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
            />
          </div>
          {stepError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{stepError}</div>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={addingStep}
              className="rounded-lg bg-amber px-4 py-1.5 text-xs font-bold text-navy-dark hover:bg-amber-dark disabled:opacity-50"
            >
              {addingStep ? "Adding..." : "Add step"}
            </button>
            <button
              type="button"
              onClick={() => { setShowAddStep(false); setStepError(null) }}
              className="rounded-lg border border-navy/15 px-4 py-1.5 text-xs font-semibold text-ink-soft hover:bg-cream-panel"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

AdminChallengeDetailPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions)
  if (!session) return { redirect: { destination: "/signin", permanent: false } }
  if (!["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole ?? ""))
    return { redirect: { destination: "/dashboard", permanent: false } }

  const id = ctx.params?.id as string
  if (id === "new") {
    return {
      redirect: { destination: "/admin/challenges/new", permanent: false },
    }
  }

  const db_ = db as never as ChallengesDb
  const challenge = await db_.challenge.findUnique({
    where: { id },
    include: {
      steps: { orderBy: [{ day: "asc" }, { order: "asc" }] },
      _count: { select: { enrollments: true } },
    },
  })

  if (!challenge) return { notFound: true }

  return { props: { challenge: JSON.parse(JSON.stringify(challenge)) } }
}

export default AdminChallengeDetailPage

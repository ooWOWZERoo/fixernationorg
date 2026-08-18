import type { NextPageWithLayout } from "@/types/next"
import type { GetServerSideProps } from "next"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/router"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { AdminLayout } from "@/components/layout/AdminLayout"

type PathwaysDb = {
  growthPathway: {
    findUnique: (args: any) => Promise<any | null>
  }
}

const STAGE_TYPES = ["MORNING_BOOST", "BLOG", "RESOURCE", "CHALLENGE", "ACTION", "GROUP", "BOOK", "EVENT", "PROVIDER"] as const
type StageType = typeof STAGE_TYPES[number]

interface Stage {
  id: string
  title: string
  description: string | null
  order: number
  stageType: StageType
  contentId: string | null
  contentTitle: string | null
  actionPrompt: string | null
  estimatedMinutes: number | null
}

interface Pathway {
  id: string
  title: string
  slug: string
  description: string
  summary: string
  focusAreaIds: string[]
  estimatedDays: number
  active: boolean
  createdAt: string
  updatedAt: string
  stages: Stage[]
  _count: { enrollments: number }
}

interface Props {
  pathway: Pathway
}

const STAGE_TYPE_LABELS: Record<StageType, string> = {
  MORNING_BOOST: "Morning Boost",
  BLOG: "Blog post",
  RESOURCE: "Resource",
  CHALLENGE: "Challenge",
  ACTION: "Action",
  GROUP: "Group activity",
  BOOK: "Book",
  EVENT: "Event",
  PROVIDER: "Provider",
}

const AdminPathwayDetailPage: NextPageWithLayout<Props> = ({ pathway: initialPathway }) => {
  const router = useRouter()
  const [pathway, setPathway] = useState(initialPathway)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Stage form
  const [showAddStage, setShowAddStage] = useState(false)
  const [stageForm, setStageForm] = useState({
    title: "",
    description: "",
    stageType: "ACTION" as StageType,
    contentId: "",
    contentTitle: "",
    actionPrompt: "",
    estimatedMinutes: "",
  })
  const [addingStage, setAddingStage] = useState(false)
  const [stageError, setStageError] = useState<string | null>(null)

  // Edit stage
  const [editingStageId, setEditingStageId] = useState<string | null>(null)
  const [editStageForm, setEditStageForm] = useState<Partial<Stage>>({})

  function setField(field: string, value: unknown) {
    setPathway((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      const res = await fetch(`/api/admin/pathways/${pathway.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: pathway.title,
          description: pathway.description,
          summary: pathway.summary,
          estimatedDays: pathway.estimatedDays,
          active: pathway.active,
          focusAreaIds: pathway.focusAreaIds,
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

  async function handleAddStage(e: React.FormEvent) {
    e.preventDefault()
    setAddingStage(true)
    setStageError(null)
    try {
      const res = await fetch(`/api/admin/pathways/${pathway.id}/stages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: stageForm.title,
          description: stageForm.description || undefined,
          stageType: stageForm.stageType,
          contentId: stageForm.contentId || undefined,
          contentTitle: stageForm.contentTitle || undefined,
          actionPrompt: stageForm.actionPrompt || undefined,
          estimatedMinutes: stageForm.estimatedMinutes ? parseInt(stageForm.estimatedMinutes, 10) : undefined,
          order: pathway.stages.length,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setStageError(data.error ?? "Failed to add stage.")
        return
      }
      setPathway((prev) => ({ ...prev, stages: [...prev.stages, data] }))
      setStageForm({ title: "", description: "", stageType: "ACTION", contentId: "", contentTitle: "", actionPrompt: "", estimatedMinutes: "" })
      setShowAddStage(false)
    } catch {
      setStageError("Network error.")
    } finally {
      setAddingStage(false)
    }
  }

  async function handleUpdateStage(stageId: string) {
    try {
      const res = await fetch(`/api/admin/pathways/stages/${stageId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editStageForm),
      })
      const data = await res.json()
      if (!res.ok) return
      setPathway((prev) => ({
        ...prev,
        stages: prev.stages.map((s) => (s.id === stageId ? { ...s, ...data } : s)),
      }))
      setEditingStageId(null)
    } catch {
      // silent
    }
  }

  async function handleDeleteStage(stageId: string) {
    if (!confirm("Delete this stage? Progress records for this stage will be preserved.")) return
    try {
      const res = await fetch(`/api/admin/pathways/stages/${stageId}`, { method: "DELETE" })
      if (res.ok || res.status === 204) {
        setPathway((prev) => ({
          ...prev,
          stages: prev.stages.filter((s) => s.id !== stageId),
        }))
      }
    } catch {
      // silent
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin/pathways" className="text-sm text-ink-soft hover:text-navy no-underline">
          ← Pathways
        </Link>
        <span className="text-ink-soft/40">/</span>
        <span className="text-sm font-semibold text-navy">{initialPathway.title}</span>
      </div>

      <div className="mb-6 flex items-start justify-between">
        <h1 className="text-2xl font-extrabold text-navy">{pathway.title}</h1>
        <span className="mt-1 text-xs text-ink-soft">{pathway._count.enrollments} enrolled</span>
      </div>

      {/* Pathway settings form */}
      <form onSubmit={handleSave} className="space-y-5 mb-8">
        <div className="rounded-2xl border border-navy/8 bg-white p-6 space-y-5">
          <h2 className="text-base font-bold text-navy">Pathway settings</h2>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-navy">Title</label>
            <input
              type="text"
              value={pathway.title}
              onChange={(e) => setField("title", e.target.value)}
              required
              className="w-full rounded-xl border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-navy">Summary</label>
            <input
              type="text"
              value={pathway.summary}
              onChange={(e) => setField("summary", e.target.value)}
              required
              className="w-full rounded-xl border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-navy">Description</label>
            <textarea
              value={pathway.description}
              onChange={(e) => setField("description", e.target.value)}
              required
              rows={4}
              className="w-full rounded-xl border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
            />
          </div>

          <div className="flex items-center gap-6">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-navy">Estimated Days</label>
              <input
                type="number"
                value={pathway.estimatedDays}
                onChange={(e) => setField("estimatedDays", parseInt(e.target.value, 10) || 14)}
                min={1}
                className="w-28 rounded-xl border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id="active"
                checked={pathway.active}
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
              value={pathway.slug}
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
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>

      {/* Stages section */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-navy">Stages ({pathway.stages.length})</h2>
        <button
          onClick={() => setShowAddStage(true)}
          className="rounded-xl bg-amber px-4 py-2 text-sm font-bold text-navy-dark hover:bg-amber-dark"
        >
          + Add stage
        </button>
      </div>

      {pathway.stages.length === 0 && !showAddStage && (
        <div className="rounded-2xl border border-navy/8 bg-white p-8 text-center mb-4">
          <p className="text-sm text-ink-soft">No stages yet. Add the first stage to build this pathway.</p>
        </div>
      )}

      <div className="space-y-2 mb-4">
        {pathway.stages.map((stage, idx) => (
          <div key={stage.id} className="rounded-2xl border border-navy/8 bg-white p-4">
            {editingStageId === stage.id ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-navy">Title</label>
                    <input
                      type="text"
                      value={editStageForm.title ?? stage.title}
                      onChange={(e) => setEditStageForm((f) => ({ ...f, title: e.target.value }))}
                      className="w-full rounded-lg border border-navy/15 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-navy">Type</label>
                    <select
                      value={editStageForm.stageType ?? stage.stageType}
                      onChange={(e) => setEditStageForm((f) => ({ ...f, stageType: e.target.value as StageType }))}
                      className="w-full rounded-lg border border-navy/15 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                    >
                      {STAGE_TYPES.map((t) => <option key={t} value={t}>{STAGE_TYPE_LABELS[t]}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-navy">Action prompt</label>
                  <textarea
                    value={editStageForm.actionPrompt ?? stage.actionPrompt ?? ""}
                    onChange={(e) => setEditStageForm((f) => ({ ...f, actionPrompt: e.target.value }))}
                    rows={2}
                    placeholder="What should the member do?"
                    className="w-full rounded-lg border border-navy/15 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-navy">Content title</label>
                    <input
                      type="text"
                      value={editStageForm.contentTitle ?? stage.contentTitle ?? ""}
                      onChange={(e) => setEditStageForm((f) => ({ ...f, contentTitle: e.target.value }))}
                      className="w-full rounded-lg border border-navy/15 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-navy">Est. minutes</label>
                    <input
                      type="number"
                      value={editStageForm.estimatedMinutes ?? stage.estimatedMinutes ?? ""}
                      onChange={(e) => setEditStageForm((f) => ({ ...f, estimatedMinutes: e.target.value ? parseInt(e.target.value, 10) : null }))}
                      min={1}
                      className="w-full rounded-lg border border-navy/15 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdateStage(stage.id)}
                    className="rounded-lg bg-amber px-3 py-1.5 text-xs font-bold text-navy-dark hover:bg-amber-dark"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setEditingStageId(null); setEditStageForm({}) }}
                    className="rounded-lg border border-navy/15 px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-cream-panel"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-4">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy/8 text-xs font-bold text-navy">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-navy text-sm">{stage.title}</span>
                    <span className="rounded-full bg-navy/8 px-2 py-0.5 text-xs font-medium text-ink-soft">
                      {STAGE_TYPE_LABELS[stage.stageType]}
                    </span>
                    {stage.estimatedMinutes && (
                      <span className="text-xs text-ink-soft">{stage.estimatedMinutes} min</span>
                    )}
                  </div>
                  {stage.actionPrompt && (
                    <p className="mt-1 text-xs text-ink-soft line-clamp-2">{stage.actionPrompt}</p>
                  )}
                  {stage.contentTitle && (
                    <p className="mt-0.5 text-xs text-ink-soft italic">{stage.contentTitle}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => { setEditingStageId(stage.id); setEditStageForm({}) }}
                    className="text-xs font-semibold text-navy hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteStage(stage.id)}
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

      {/* Add stage form */}
      {showAddStage && (
        <form onSubmit={handleAddStage} className="rounded-2xl border border-amber/40 bg-amber/5 p-5 space-y-4 mb-4">
          <h3 className="text-sm font-bold text-navy">New stage</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-navy">Title</label>
              <input
                type="text"
                value={stageForm.title}
                onChange={(e) => setStageForm((f) => ({ ...f, title: e.target.value }))}
                required
                className="w-full rounded-lg border border-navy/15 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-navy">Type</label>
              <select
                value={stageForm.stageType}
                onChange={(e) => setStageForm((f) => ({ ...f, stageType: e.target.value as StageType }))}
                className="w-full rounded-lg border border-navy/15 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              >
                {STAGE_TYPES.map((t) => <option key={t} value={t}>{STAGE_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-navy">Action prompt</label>
            <textarea
              value={stageForm.actionPrompt}
              onChange={(e) => setStageForm((f) => ({ ...f, actionPrompt: e.target.value }))}
              rows={2}
              placeholder="What should the member do at this stage?"
              className="w-full rounded-lg border border-navy/15 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-navy">Content title <span className="font-normal text-ink-soft">(optional)</span></label>
              <input
                type="text"
                value={stageForm.contentTitle}
                onChange={(e) => setStageForm((f) => ({ ...f, contentTitle: e.target.value }))}
                className="w-full rounded-lg border border-navy/15 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-navy">Est. minutes <span className="font-normal text-ink-soft">(optional)</span></label>
              <input
                type="number"
                value={stageForm.estimatedMinutes}
                onChange={(e) => setStageForm((f) => ({ ...f, estimatedMinutes: e.target.value }))}
                min={1}
                className="w-full rounded-lg border border-navy/15 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              />
            </div>
          </div>
          {stageError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{stageError}</div>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={addingStage}
              className="rounded-lg bg-amber px-4 py-1.5 text-xs font-bold text-navy-dark hover:bg-amber-dark disabled:opacity-50"
            >
              {addingStage ? "Adding…" : "Add stage"}
            </button>
            <button
              type="button"
              onClick={() => { setShowAddStage(false); setStageError(null) }}
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

AdminPathwayDetailPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions)
  if (!session) return { redirect: { destination: "/signin", permanent: false } }
  if (!["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole ?? "")) {
    return { redirect: { destination: "/dashboard", permanent: false } }
  }

  const id = ctx.params?.id as string
  if (id === "new") return { redirect: { destination: "/admin/pathways/new", permanent: false } }

  const db_ = db as never as PathwaysDb
  const pathway = await db_.growthPathway.findUnique({
    where: { id },
    include: {
      stages: { orderBy: { order: "asc" } },
      _count: { select: { enrollments: true } },
    },
  })

  if (!pathway) return { notFound: true }

  return { props: { pathway: JSON.parse(JSON.stringify(pathway)) } }
}

export default AdminPathwayDetailPage

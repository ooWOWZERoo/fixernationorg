import type { NextPageWithLayout } from "@/types/next"
import type { GetServerSideProps } from "next"
import { useState } from "react"
import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { AdminLayout } from "@/components/layout/AdminLayout"

type RecommendationRow = {
  id: string
  recommendationType: string
  resourceId: string
  resourceTitle: string
  priority: number
}

type TopicDetail = {
  id: string
  title: string
  slug: string
  description: string | null
  focusAreaId: string | null
  active: boolean
  order: number
  recommendationMaps: RecommendationRow[]
}

type Props = { topic: TopicDetail }

type IssueTopicsDb = {
  issueTopic: {
    findUnique: (args: Record<string, unknown>) => Promise<unknown | null>
  }
}

const REC_TYPE_LABELS: Record<string, string> = {
  PATHWAY: "Pathway",
  CHALLENGE: "Challenge",
  RESOURCE: "Resource",
  BLOG_POST: "Blog post",
}

const AdminIssueTopicDetailPage: NextPageWithLayout<Props> = ({ topic: initial }) => {
  const [topic, setTopic] = useState(initial)
  const [form, setForm] = useState({
    title: initial.title,
    description: initial.description ?? "",
    order: initial.order,
    active: initial.active,
  })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [recForm, setRecForm] = useState({
    recommendationType: "PATHWAY" as string,
    resourceId: "",
    resourceTitle: "",
    priority: 0,
  })
  const [recSaving, setRecSaving] = useState(false)
  const [recError, setRecError] = useState<string | null>(null)

  function setField(field: string, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveMsg(null)
    setSaveError(null)
    try {
      const res = await fetch(`/api/admin/issue-topics/${topic.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setSaveError(data.error?.message ?? data.error ?? "Failed to save.")
        return
      }
      setTopic((prev) => ({ ...prev, ...data }))
      setSaveMsg("Saved.")
    } catch {
      setSaveError("Network error.")
    } finally {
      setSaving(false)
    }
  }

  async function handleAddRec(e: React.FormEvent) {
    e.preventDefault()
    setRecSaving(true)
    setRecError(null)
    try {
      const res = await fetch(`/api/admin/issue-topics/${topic.id}/recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(recForm),
      })
      const data = await res.json()
      if (!res.ok) {
        setRecError(data.error?.message ?? data.error ?? "Failed to add recommendation.")
        return
      }
      setTopic((prev) => ({
        ...prev,
        recommendationMaps: [...prev.recommendationMaps, data].sort(
          (a, b) => b.priority - a.priority
        ),
      }))
      setRecForm({ recommendationType: "PATHWAY", resourceId: "", resourceTitle: "", priority: 0 })
    } catch {
      setRecError("Network error.")
    } finally {
      setRecSaving(false)
    }
  }

  async function handleDeleteRec(recommendationId: string) {
    try {
      await fetch(
        `/api/admin/issue-topics/${topic.id}/recommendations?recommendationId=${recommendationId}`,
        { method: "DELETE" }
      )
      setTopic((prev) => ({
        ...prev,
        recommendationMaps: prev.recommendationMaps.filter((r) => r.id !== recommendationId),
      }))
    } catch {
      // ignore
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-center gap-3">
        <Link href="/admin/issue-topics" className="text-sm text-ink-soft hover:text-navy no-underline">
          ← Issue Topics
        </Link>
        <span className="text-ink-soft/40">/</span>
        <span className="text-sm font-semibold text-navy">{topic.title}</span>
      </div>

      {/* Edit topic */}
      <section>
        <h1 className="mb-4 text-2xl font-extrabold text-navy">Edit Topic</h1>
        <form onSubmit={handleSave} className="rounded-2xl border border-navy/8 bg-white p-6 space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-navy">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setField("title", e.target.value)}
              required
              className="w-full rounded-xl border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-navy">
              Description <span className="font-normal text-ink-soft">(optional)</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-navy">Display order</label>
            <input
              type="number"
              value={form.order}
              onChange={(e) => setField("order", parseInt(e.target.value, 10) || 0)}
              min={0}
              className="w-full rounded-xl border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="active"
              checked={form.active}
              onChange={(e) => setField("active", e.target.checked)}
              className="h-4 w-4 rounded border-navy/30 accent-navy"
            />
            <label htmlFor="active" className="text-sm font-medium text-navy">
              Active (visible to members)
            </label>
          </div>

          {saveError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {saveError}
            </div>
          )}
          {saveMsg && (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {saveMsg}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-amber px-5 py-2.5 text-sm font-bold text-navy-dark hover:bg-amber-dark disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </section>

      {/* Manage recommendations */}
      <section>
        <h2 className="mb-4 text-xl font-bold text-navy">Recommendations</h2>

        <div className="mb-4 rounded-2xl border border-navy/8 bg-white p-6 space-y-4">
          <p className="text-sm font-semibold text-navy">Add recommendation</p>
          <form onSubmit={handleAddRec} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-ink-soft uppercase tracking-wide">Type</label>
                <select
                  value={recForm.recommendationType}
                  onChange={(e) => setRecForm((p) => ({ ...p, recommendationType: e.target.value }))}
                  className="w-full rounded-xl border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                >
                  <option value="PATHWAY">Pathway</option>
                  <option value="CHALLENGE">Challenge</option>
                  <option value="RESOURCE">Resource</option>
                  <option value="BLOG_POST">Blog post</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-ink-soft uppercase tracking-wide">Priority</label>
                <input
                  type="number"
                  value={recForm.priority}
                  onChange={(e) => setRecForm((p) => ({ ...p, priority: parseInt(e.target.value, 10) || 0 }))}
                  className="w-full rounded-xl border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink-soft uppercase tracking-wide">Resource ID</label>
              <input
                type="text"
                value={recForm.resourceId}
                onChange={(e) => setRecForm((p) => ({ ...p, resourceId: e.target.value }))}
                required
                placeholder="ID of the pathway, challenge, resource, or post"
                className="w-full rounded-xl border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink-soft uppercase tracking-wide">Resource title</label>
              <input
                type="text"
                value={recForm.resourceTitle}
                onChange={(e) => setRecForm((p) => ({ ...p, resourceTitle: e.target.value }))}
                required
                placeholder="Display title for this recommendation"
                className="w-full rounded-xl border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              />
            </div>

            {recError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {recError}
              </div>
            )}

            <button
              type="submit"
              disabled={recSaving}
              className="rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy/80 disabled:opacity-50"
            >
              {recSaving ? "Adding…" : "Add recommendation"}
            </button>
          </form>
        </div>

        {topic.recommendationMaps.length === 0 ? (
          <p className="text-sm text-ink-soft">No recommendations yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl bg-white shadow">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Resource ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Priority</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topic.recommendationMaps.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-navy/8 px-2 py-0.5 text-xs font-semibold text-navy">
                        {REC_TYPE_LABELS[r.recommendationType] ?? r.recommendationType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-navy">{r.resourceTitle}</td>
                    <td className="px-4 py-3 text-xs text-slate-400 font-mono">{r.resourceId}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{r.priority}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDeleteRec(r.id)}
                        className="text-sm font-semibold text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

AdminIssueTopicDetailPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions)
  if (!session) return { redirect: { destination: "/signin", permanent: false } }
  if (!["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole ?? ""))
    return { redirect: { destination: "/dashboard", permanent: false } }

  const { id } = ctx.params as { id: string }

  const db_ = db as never as IssueTopicsDb
  const topic = await db_.issueTopic.findUnique({
    where: { id },
    include: {
      recommendationMaps: {
        orderBy: { priority: "desc" },
      },
    },
  })

  if (!topic) return { notFound: true }

  return { props: { topic: JSON.parse(JSON.stringify(topic)) } }
}

export default AdminIssueTopicDetailPage

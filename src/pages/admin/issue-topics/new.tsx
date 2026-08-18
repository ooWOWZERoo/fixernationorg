import type { NextPageWithLayout } from "@/types/next"
import type { GetServerSideProps } from "next"
import { useState } from "react"
import { useRouter } from "next/router"
import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { AdminLayout } from "@/components/layout/AdminLayout"

interface Props {}

const NewIssueTopicPage: NextPageWithLayout<Props> = () => {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: "",
    description: "",
    order: 0,
    active: true,
  })

  function set(field: string, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/issue-topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error?.message ?? data.error ?? "Something went wrong.")
        return
      }
      router.push(`/admin/issue-topics/${data.id}`)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin/issue-topics" className="text-sm text-ink-soft hover:text-navy no-underline">
          ← Issue Topics
        </Link>
        <span className="text-ink-soft/40">/</span>
        <span className="text-sm font-semibold text-navy">New topic</span>
      </div>

      <h1 className="mb-6 text-2xl font-extrabold text-navy">New Issue Topic</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-2xl border border-navy/8 bg-white p-6 space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-navy">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              required
              placeholder="e.g. Struggling to get new clients"
              className="w-full rounded-xl border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-navy">
              Description <span className="font-normal text-ink-soft">(optional)</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={4}
              placeholder="A short explanation of this issue — what it means, who it affects."
              className="w-full rounded-xl border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-navy">Display order</label>
            <input
              type="number"
              value={form.order}
              onChange={(e) => set("order", parseInt(e.target.value, 10) || 0)}
              min={0}
              className="w-full rounded-xl border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="active"
              checked={form.active}
              onChange={(e) => set("active", e.target.checked)}
              className="h-4 w-4 rounded border-navy/30 accent-navy"
            />
            <label htmlFor="active" className="text-sm font-medium text-navy">
              Active (visible to members)
            </label>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-amber px-5 py-2.5 text-sm font-bold text-navy-dark hover:bg-amber-dark disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create topic"}
          </button>
          <Link
            href="/admin/issue-topics"
            className="rounded-xl border border-navy/15 px-5 py-2.5 text-sm font-semibold text-ink-soft no-underline hover:bg-cream-panel"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}

NewIssueTopicPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions)
  if (!session) return { redirect: { destination: "/signin", permanent: false } }
  if (!["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole ?? ""))
    return { redirect: { destination: "/dashboard", permanent: false } }
  return { props: {} }
}

export default NewIssueTopicPage

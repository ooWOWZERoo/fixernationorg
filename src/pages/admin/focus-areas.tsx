import Head from "next/head"
import { useState } from "react"
import { GetServerSideProps } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { AdminLayout } from "@/components/layout/AdminLayout"
import type { NextPageWithLayout } from "@/types/next"

type FocusAreaDb = {
  focusArea: {
    findMany: (args?: { orderBy?: object }) => Promise<FocusAreaRow[]>
  }
}

type FocusAreaRow = {
  id: string
  name: string
  order: number
  active: boolean
  createdAt: string
  updatedAt: string
}

interface Props {
  initialAreas: FocusAreaRow[]
}

const AdminFocusAreasPage: NextPageWithLayout<Props> = ({ initialAreas }) => {
  const [areas, setAreas] = useState<FocusAreaRow[]>(initialAreas)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editOrder, setEditOrder] = useState(0)
  const [newName, setNewName] = useState("")
  const [newOrder, setNewOrder] = useState(areas.length + 1)
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function startEdit(area: FocusAreaRow) {
    setEditingId(area.id)
    setEditName(area.name)
    setEditOrder(area.order)
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setError(null)
  }

  async function saveEdit(id: string) {
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/admin/focus-areas/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, order: editOrder }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error?.message ?? data.error ?? "Failed to save.")
    } else {
      setAreas((prev) =>
        prev.map((a) => (a.id === id ? { ...a, name: data.area.name, order: data.area.order } : a))
      )
      setEditingId(null)
    }
    setSaving(false)
  }

  async function toggleActive(area: FocusAreaRow) {
    const res = await fetch(`/api/admin/focus-areas/${area.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !area.active }),
    })
    const data = await res.json()
    if (res.ok) {
      setAreas((prev) =>
        prev.map((a) => (a.id === area.id ? { ...a, active: data.area.active } : a))
      )
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this focus area? This cannot be undone.")) return
    const res = await fetch(`/api/admin/focus-areas/${id}`, { method: "DELETE" })
    const data = await res.json()
    if (!res.ok) {
      alert(data.error ?? "Could not delete.")
    } else {
      setAreas((prev) => prev.filter((a) => a.id !== id))
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    setError(null)
    const res = await fetch("/api/admin/focus-areas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), order: newOrder }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error?.message ?? data.error ?? "Failed to add.")
    } else {
      setAreas((prev) => [...prev, data.area])
      setNewName("")
      setNewOrder(areas.length + 2)
    }
    setAdding(false)
  }

  const sorted = [...areas].sort((a, b) => a.order - b.order)

  return (
    <>
      <Head><title>Focus Areas — Admin</title></Head>

      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-navy">Focus Areas</h1>
        <p className="mt-1 text-sm text-ink-soft">
          These are the topics members can choose when setting up their focus at{" "}
          <code className="rounded bg-navy/8 px-1 text-xs">/account/focus</code>.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-navy/8 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy/8 text-left text-xs font-bold uppercase tracking-widest text-ink-soft">
                <th className="px-5 py-3">Order</th>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((area) => (
                <tr key={area.id} className="border-b border-navy/5 hover:bg-cream-panel/40">
                  <td className="px-5 py-3 font-mono text-xs text-ink-soft w-16">
                    {editingId === area.id ? (
                      <input
                        type="number"
                        value={editOrder}
                        onChange={(e) => setEditOrder(parseInt(e.target.value) || 0)}
                        className="w-16 rounded border border-navy/20 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-navy/30"
                      />
                    ) : (
                      area.order
                    )}
                  </td>
                  <td className="px-5 py-3 font-semibold text-navy">
                    {editingId === area.id ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded-lg border border-navy/20 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-navy/30"
                        autoFocus
                      />
                    ) : (
                      area.name
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        area.active
                          ? "bg-green-100 text-green-800"
                          : "bg-navy/8 text-ink-soft"
                      }`}
                    >
                      {area.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {editingId === area.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => saveEdit(area.id)}
                          disabled={saving}
                          className="rounded-lg bg-navy px-3 py-1.5 text-xs font-bold text-white hover:bg-navy-dark disabled:opacity-50"
                        >
                          {saving ? "Saving…" : "Save"}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="rounded-lg border border-navy/15 px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-cream-panel"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => startEdit(area)}
                          className="rounded-lg border border-navy/15 px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-cream-panel"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleActive(area)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                            area.active
                              ? "border-amber/30 bg-amber/8 text-amber-dark hover:bg-amber/20"
                              : "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
                          }`}
                        >
                          {area.active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          onClick={() => handleDelete(area.id)}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add new */}
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-bold text-navy">Add a focus area</h2>
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="mb-1 block text-xs font-semibold text-ink-soft">Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Sleep & recovery"
              maxLength={100}
              className="w-full rounded-xl border border-navy/15 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
            />
          </div>
          <div className="w-24">
            <label className="mb-1 block text-xs font-semibold text-ink-soft">Order</label>
            <input
              type="number"
              value={newOrder}
              onChange={(e) => setNewOrder(parseInt(e.target.value) || 0)}
              className="w-full rounded-xl border border-navy/15 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
            />
          </div>
          <button
            type="submit"
            disabled={adding || !newName.trim()}
            className="rounded-xl bg-amber px-5 py-2.5 text-sm font-bold text-navy-dark hover:bg-amber-dark disabled:opacity-50 transition-colors"
          >
            {adding ? "Adding…" : "+ Add"}
          </button>
        </form>
      </div>
    </>
  )
}

AdminFocusAreasPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>
export default AdminFocusAreasPage

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions)
  if (!session?.user?.adminRole || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return { redirect: { destination: "/", permanent: false } }
  }

  const db_ = db as never as FocusAreaDb
  const areas = await db_.focusArea.findMany({ orderBy: { order: "asc" } as object })

  return {
    props: {
      initialAreas: JSON.parse(JSON.stringify(areas)),
    },
  }
}

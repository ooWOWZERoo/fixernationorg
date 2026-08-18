import Head from "next/head"
import { AccountNav } from "@/components/account/AccountNav"
import { useState } from "react"
import { GetServerSideProps } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { SiteLayout } from "@/components/layout/SiteLayout"
import type { NextPageWithLayout } from "@/types/next"

type PlanDb = {
  fixerPlan: {
    findFirst: (args: { where: object; include?: object }) => Promise<FixerPlanRow | null>
    findMany: (args: { where: object; orderBy?: object; take?: number }) => Promise<FixerPlanRow[]>
  }
}

type PlanItemRow = {
  id: string
  planId: string
  type: string
  refId: string | null
  title: string
  notes: string | null
  order: number
  status: string
  completedAt: string | null
  createdAt: string
}

type FixerPlanRow = {
  id: string
  userId: string
  title: string
  focusAreaId: string | null
  status: string
  createdAt: string
  updatedAt: string
  items?: PlanItemRow[]
}

interface Props {
  activePlan: FixerPlanRow | null
  pastPlans: FixerPlanRow[]
}

const ITEM_TYPES = [
  "CONTENT", "ACTION", "PATHWAY", "CHALLENGE",
  "GROUP", "PROVIDER", "BOOK", "EVENT",
] as const

const TYPE_LABELS: Record<string, string> = {
  CONTENT: "Content",
  ACTION: "Action",
  PATHWAY: "Pathway",
  CHALLENGE: "Challenge",
  GROUP: "Group",
  PROVIDER: "Provider",
  BOOK: "Book",
  EVENT: "Event",
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  COMPLETED: "Done",
  SKIPPED: "Skipped",
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber/15 text-amber-dark",
  COMPLETED: "bg-green-50 text-green-700",
  SKIPPED: "bg-navy/8 text-ink-soft",
}

const MyPlanPage: NextPageWithLayout<Props> = ({ activePlan: initialPlan, pastPlans: initialPast }) => {
  const [activePlan, setActivePlan] = useState<FixerPlanRow | null>(initialPlan)
  const [pastPlans, setPastPlans] = useState<FixerPlanRow[]>(initialPast)
  const [showNewPlanModal, setShowNewPlanModal] = useState(false)
  const [showAddItemModal, setShowAddItemModal] = useState(false)
  const [showPastPlans, setShowPastPlans] = useState(false)
  const [archiving, setArchiving] = useState(false)

  // New plan form
  const [newPlanTitle, setNewPlanTitle] = useState("")
  const [creatingPlan, setCreatingPlan] = useState(false)
  const [planError, setPlanError] = useState<string | null>(null)

  // Add item form
  const [itemType, setItemType] = useState<string>("ACTION")
  const [itemTitle, setItemTitle] = useState("")
  const [itemRefId, setItemRefId] = useState("")
  const [itemNotes, setItemNotes] = useState("")
  const [addingItem, setAddingItem] = useState(false)
  const [itemError, setItemError] = useState<string | null>(null)

  async function handleCreatePlan(e: React.FormEvent) {
    e.preventDefault()
    if (!newPlanTitle.trim()) return
    setCreatingPlan(true)
    setPlanError(null)

    const res = await fetch("/api/account/my-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newPlanTitle.trim() }),
    })
    const data = await res.json()
    if (!res.ok) {
      setPlanError(typeof data.error === "string" ? data.error : "Something went wrong.")
    } else {
      // Move current active to past plans if there was one
      if (activePlan) {
        setPastPlans((prev) => [{ ...activePlan, status: "PAUSED" }, ...prev].slice(0, 5))
      }
      setActivePlan(data.plan)
      setNewPlanTitle("")
      setShowNewPlanModal(false)
    }
    setCreatingPlan(false)
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault()
    if (!activePlan || !itemTitle.trim()) return
    setAddingItem(true)
    setItemError(null)

    const res = await fetch(`/api/account/my-plan/${activePlan.id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: itemType,
        title: itemTitle.trim(),
        refId: itemRefId.trim() || null,
        notes: itemNotes.trim() || null,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setItemError(typeof data.error === "string" ? data.error : "Something went wrong.")
    } else {
      setActivePlan((prev) =>
        prev
          ? { ...prev, items: [...(prev.items ?? []), data.item] }
          : prev
      )
      setItemTitle("")
      setItemRefId("")
      setItemNotes("")
      setShowAddItemModal(false)
    }
    setAddingItem(false)
  }

  async function handleItemStatus(itemId: string, status: string) {
    const res = await fetch(`/api/account/my-plan/items/${itemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) return
    const data = await res.json()
    setActivePlan((prev) =>
      prev
        ? {
            ...prev,
            items: (prev.items ?? []).map((i) => (i.id === itemId ? data.item : i)),
          }
        : prev
    )
  }

  async function handleDeleteItem(itemId: string) {
    if (!window.confirm("Remove this item from your plan?")) return
    const res = await fetch(`/api/account/my-plan/items/${itemId}`, { method: "DELETE" })
    if (!res.ok) return
    setActivePlan((prev) =>
      prev ? { ...prev, items: (prev.items ?? []).filter((i) => i.id !== itemId) } : prev
    )
  }

  async function handleArchivePlan() {
    if (!activePlan) return
    if (!window.confirm("Archive this plan? It will move to your past plans.")) return
    setArchiving(true)
    const res = await fetch(`/api/account/my-plan/${activePlan.id}`, { method: "DELETE" })
    if (res.ok) {
      const data = await res.json()
      setPastPlans((prev) => [data.plan, ...prev].slice(0, 5))
      setActivePlan(null)
    }
    setArchiving(false)
  }

  const items = activePlan?.items ?? []
  const pendingItems = items.filter((i) => i.status === "PENDING")
  const doneItems = items.filter((i) => i.status !== "PENDING")

  return (
    <>
      <Head>
        <title>My Fixer Plan — Fixer Nation</title>
      </Head>

      <section className="px-6 py-14 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <AccountNav />

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-navy">My Fixer Plan</h1>
              <p className="mt-2 text-sm text-ink-soft">
                Map out what you&apos;re working on, add the pieces that matter, and check things off as you go.
              </p>
            </div>
            <button
              onClick={() => setShowNewPlanModal(true)}
              className="shrink-0 rounded-[10px] bg-navy px-4 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_-10px_rgba(20,40,56,0.4)] hover:bg-navy-dark transition-colors"
            >
              New plan
            </button>
          </div>

          {/* Active plan */}
          {activePlan ? (
            <div className="mt-10">
              <div className="flex items-center justify-between gap-4 mb-5">
                <div>
                  <span className="text-xs font-bold uppercase tracking-widest text-amber-dark">Active plan</span>
                  <h2 className="mt-0.5 text-xl font-extrabold text-navy">{activePlan.title}</h2>
                </div>
                <button
                  onClick={() => setShowAddItemModal(true)}
                  className="shrink-0 rounded-[10px] border border-navy/20 bg-white px-4 py-2.5 text-sm font-bold text-navy hover:bg-cream-panel transition-colors"
                >
                  Add item
                </button>
              </div>

              {items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-navy/15 px-6 py-10 text-center">
                  <p className="text-sm text-ink-soft">
                    No items yet. Hit &ldquo;Add item&rdquo; to start filling this out.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 rounded-xl border border-navy/10 bg-white px-4 py-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-ink-soft">
                            {TYPE_LABELS[item.type] ?? item.type}
                          </span>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[item.status] ?? ""}`}>
                            {STATUS_LABELS[item.status] ?? item.status}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-navy">{item.title}</p>
                        {item.notes && (
                          <p className="mt-0.5 text-xs text-ink-soft line-clamp-2">{item.notes}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => handleItemStatus(item.id, "COMPLETED")}
                          className="rounded-lg bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700 hover:bg-green-100 transition-colors"
                        >
                          Done
                        </button>
                        <button
                          onClick={() => handleItemStatus(item.id, "SKIPPED")}
                          className="rounded-lg bg-navy/5 px-3 py-1.5 text-xs font-bold text-ink-soft hover:bg-navy/10 transition-colors"
                        >
                          Skip
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="rounded-lg bg-navy/5 px-3 py-1.5 text-xs font-bold text-ink-soft hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="Remove from plan"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}

                  {doneItems.length > 0 && (
                    <>
                      <p className="pt-4 text-xs font-bold uppercase tracking-widest text-ink-soft">
                        Done
                      </p>
                      {doneItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start gap-3 rounded-xl border border-navy/8 bg-cream-panel px-4 py-3 opacity-60"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-0.5">
                              <span className="text-xs font-semibold text-ink-soft">
                                {TYPE_LABELS[item.type] ?? item.type}
                              </span>
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[item.status] ?? ""}`}>
                                {STATUS_LABELS[item.status] ?? item.status}
                              </span>
                            </div>
                            <p className="text-sm font-semibold text-navy line-through">{item.title}</p>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button
                              onClick={() => handleItemStatus(item.id, "PENDING")}
                              className="rounded-lg bg-navy/5 px-3 py-1.5 text-xs font-bold text-ink-soft hover:bg-navy/10 transition-colors"
                            >
                              Undo
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="rounded-lg bg-navy/5 px-3 py-1.5 text-xs font-bold text-ink-soft hover:bg-red-50 hover:text-red-600 transition-colors"
                              title="Remove from plan"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-10 rounded-2xl border border-dashed border-navy/15 px-6 py-14 text-center">
              <p className="text-base font-semibold text-navy">No plan yet.</p>
              <p className="mt-2 text-sm text-ink-soft">
                Create one and start pulling together what you want to tackle.
              </p>
              <button
                onClick={() => setShowNewPlanModal(true)}
                className="mt-6 rounded-[10px] bg-navy px-6 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_-10px_rgba(20,40,56,0.4)] hover:bg-navy-dark transition-colors"
              >
                Start my first plan
              </button>
            </div>
          )}

          {/* Archive plan */}
          {activePlan && (
            <div className="mt-8 flex justify-end">
              <button
                onClick={handleArchivePlan}
                disabled={archiving}
                className="text-xs text-ink-soft hover:text-red-600 transition-colors disabled:opacity-50"
              >
                {archiving ? "Archiving…" : "Archive this plan"}
              </button>
            </div>
          )}

          {/* Past plans */}
          {pastPlans.length > 0 && (
            <div className="mt-12">
              <button
                onClick={() => setShowPastPlans((v) => !v)}
                className="flex items-center gap-2 text-sm font-bold text-ink-soft hover:text-navy transition-colors"
              >
                <span>{showPastPlans ? "▾" : "▸"}</span>
                Past plans ({pastPlans.length})
              </button>

              {showPastPlans && (
                <div className="mt-4 space-y-2">
                  {pastPlans.map((plan) => (
                    <div
                      key={plan.id}
                      className="flex items-center justify-between rounded-xl border border-navy/10 bg-white px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-navy">{plan.title}</p>
                        <p className="text-xs text-ink-soft capitalize">{plan.status.toLowerCase()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* New plan modal */}
      {showNewPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-extrabold text-navy">New plan</h2>
            {activePlan && (
              <p className="mt-2 text-sm text-amber-dark">
                This will pause your current plan. You can pick it back up whenever you&apos;re ready.
              </p>
            )}
            <form onSubmit={handleCreatePlan} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-ink-soft mb-1.5">
                  Plan name
                </label>
                <input
                  type="text"
                  value={newPlanTitle}
                  onChange={(e) => setNewPlanTitle(e.target.value)}
                  placeholder="e.g. Fix the bathroom before summer"
                  className="w-full rounded-xl border border-navy/15 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                  autoFocus
                />
              </div>
              {planError && (
                <p className="text-sm text-red-600">{planError}</p>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={creatingPlan || !newPlanTitle.trim()}
                  className="flex-1 rounded-[10px] bg-navy py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_-10px_rgba(20,40,56,0.4)] hover:bg-navy-dark disabled:opacity-50 transition-colors"
                >
                  {creatingPlan ? "Creating…" : "Create plan"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowNewPlanModal(false); setPlanError(null) }}
                  className="flex-1 rounded-[10px] border border-navy/15 py-2.5 text-sm font-bold text-ink hover:bg-cream-panel transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add item modal */}
      {showAddItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-extrabold text-navy">Add something to your plan</h2>
            <form onSubmit={handleAddItem} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-ink-soft mb-1.5">
                  Type
                </label>
                <select
                  value={itemType}
                  onChange={(e) => setItemType(e.target.value)}
                  className="w-full rounded-xl border border-navy/15 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                >
                  {ITEM_TYPES.map((t) => (
                    <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-ink-soft mb-1.5">
                  Title
                </label>
                <input
                  type="text"
                  value={itemTitle}
                  onChange={(e) => setItemTitle(e.target.value)}
                  placeholder="What do you want to do?"
                  className="w-full rounded-xl border border-navy/15 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-ink-soft mb-1.5">
                  Notes <span className="normal-case font-normal">(optional)</span>
                </label>
                <textarea
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-navy/15 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 resize-none"
                />
              </div>
              {itemError && (
                <p className="text-sm text-red-600">{itemError}</p>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={addingItem || !itemTitle.trim()}
                  className="flex-1 rounded-[10px] bg-navy py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_-10px_rgba(20,40,56,0.4)] hover:bg-navy-dark disabled:opacity-50 transition-colors"
                >
                  {addingItem ? "Adding…" : "Add to plan"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddItemModal(false); setItemError(null) }}
                  className="flex-1 rounded-[10px] border border-navy/15 py-2.5 text-sm font-bold text-ink hover:bg-cream-panel transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

MyPlanPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>
export default MyPlanPage

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions)
  if (!session) {
    return {
      redirect: {
        destination: `/signin?callbackUrl=${encodeURIComponent("/account/my-plan")}`,
        permanent: false,
      },
    }
  }

  const db_ = db as never as PlanDb

  const [activePlan, pastPlans] = await Promise.all([
    db_.fixerPlan.findFirst({
      where: { userId: session.user.id, status: "ACTIVE" },
      include: { items: { orderBy: { order: "asc" } } },
    }),
    db_.fixerPlan.findMany({
      where: {
        userId: session.user.id,
        status: { in: ["PAUSED", "COMPLETED", "ARCHIVED"] },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
  ])

  return {
    props: {
      activePlan: activePlan ? JSON.parse(JSON.stringify(activePlan)) : null,
      pastPlans: JSON.parse(JSON.stringify(pastPlans)),
    },
  }
}

import Head from "next/head"
import { AccountNav } from "@/components/account/AccountNav"
import { useState } from "react"
import { GetServerSideProps } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { SiteLayout } from "@/components/layout/SiteLayout"
import type { NextPageWithLayout } from "@/types/next"

type ActionDb = {
  memberAction: {
    findMany: (args: { where: object; orderBy?: object }) => Promise<ActionRow[]>
  }
}

type ActionRow = {
  id: string
  title: string
  description: string | null
  dueDate: string | null
  source: string | null
  planId: string | null
  status: string
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

interface Props {
  actions: ActionRow[]
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber/15 text-amber-dark",
  COMPLETED: "bg-green-50 text-green-700",
  SKIPPED: "bg-navy/8 text-ink-soft",
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  COMPLETED: "Done",
  SKIPPED: "Skipped",
}

const ActionsPage: NextPageWithLayout<Props> = ({ actions: initialActions }) => {
  const [actions, setActions] = useState<ActionRow[]>(initialActions)
  const [title, setTitle] = useState("")
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setAdding(true)
    setAddError(null)

    const res = await fetch("/api/account/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), source: "manual" }),
    })
    const data = await res.json()
    if (!res.ok) {
      setAddError(typeof data.error === "string" ? data.error : "Something went wrong.")
    } else {
      setActions((prev) => [data.action, ...prev])
      setTitle("")
    }
    setAdding(false)
  }

  async function handleStatus(id: string, status: string) {
    const res = await fetch(`/api/account/actions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) return
    const data = await res.json()
    setActions((prev) => prev.map((a) => (a.id === id ? data.action : a)))
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/account/actions/${id}`, { method: "DELETE" })
    if (!res.ok) return
    setActions((prev) => prev.filter((a) => a.id !== id))
  }

  const pending = actions.filter((a) => a.status === "PENDING")
  const done = actions.filter((a) => a.status !== "PENDING")

  return (
    <>
      <Head>
        <title>My Actions — Fixer Nation</title>
      </Head>

      <section className="px-6 py-14 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <AccountNav />

          <h1 className="text-3xl font-extrabold tracking-tight text-navy">My Actions</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Small to-dos that don&apos;t need a full plan. Drop them here and knock them out.
          </p>

          {/* Add action form */}
          <form onSubmit={handleAdd} className="mt-8 flex gap-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What do you want to do?"
              className="flex-1 rounded-xl border border-navy/15 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
            />
            <button
              type="submit"
              disabled={adding || !title.trim()}
              className="shrink-0 rounded-[10px] bg-navy px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_-10px_rgba(20,40,56,0.4)] hover:bg-navy-dark disabled:opacity-50 transition-colors"
            >
              {adding ? "Adding…" : "Add action"}
            </button>
          </form>
          {addError && (
            <p className="mt-2 text-sm text-red-600">{addError}</p>
          )}

          {/* Pending actions */}
          <div className="mt-8">
            {pending.length === 0 && done.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-navy/15 px-6 py-12 text-center">
                <p className="text-sm text-ink-soft">
                  Nothing here yet. Add something you want to get done.
                </p>
              </div>
            ) : (
              <>
                {pending.length > 0 && (
                  <div className="space-y-2">
                    {pending.map((action) => (
                      <div
                        key={action.id}
                        className="flex items-start gap-3 rounded-xl border border-navy/10 bg-white px-4 py-3"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-navy">{action.title}</p>
                          {action.dueDate && (
                            <p className="mt-0.5 text-xs text-ink-soft">
                              Due {new Date(action.dueDate).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button
                            onClick={() => handleStatus(action.id, "COMPLETED")}
                            className="rounded-lg bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700 hover:bg-green-100 transition-colors"
                          >
                            Done
                          </button>
                          <button
                            onClick={() => handleStatus(action.id, "SKIPPED")}
                            className="rounded-lg bg-navy/5 px-3 py-1.5 text-xs font-bold text-ink-soft hover:bg-navy/10 transition-colors"
                          >
                            Skip
                          </button>
                          <button
                            onClick={() => handleDelete(action.id)}
                            className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {done.length > 0 && (
                  <div className="mt-8 space-y-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-ink-soft mb-3">
                      Done
                    </p>
                    {done.map((action) => (
                      <div
                        key={action.id}
                        className="flex items-start gap-3 rounded-xl border border-navy/8 bg-cream-panel px-4 py-3 opacity-60"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[action.status] ?? ""}`}>
                              {STATUS_LABELS[action.status] ?? action.status}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-navy line-through">{action.title}</p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button
                            onClick={() => handleStatus(action.id, "PENDING")}
                            className="rounded-lg bg-navy/5 px-3 py-1.5 text-xs font-bold text-ink-soft hover:bg-navy/10 transition-colors"
                          >
                            Undo
                          </button>
                          <button
                            onClick={() => handleDelete(action.id)}
                            className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </>
  )
}

ActionsPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>
export default ActionsPage

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions)
  if (!session) {
    return {
      redirect: {
        destination: `/signin?callbackUrl=${encodeURIComponent("/account/actions")}`,
        permanent: false,
      },
    }
  }

  const db_ = db as never as ActionDb
  const actions = await db_.memberAction.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  })

  return {
    props: {
      actions: JSON.parse(JSON.stringify(actions)),
    },
  }
}

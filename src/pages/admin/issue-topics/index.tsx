import type { NextPageWithLayout } from "@/types/next"
import type { GetServerSideProps } from "next"
import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { AdminLayout } from "@/components/layout/AdminLayout"

type TopicRow = {
  id: string
  title: string
  slug: string
  focusAreaId: string | null
  active: boolean
  order: number
  createdAt: string
  _count: { memberIssues: number; recommendationMaps: number }
}

type Props = { topics: TopicRow[] }

type IssueTopicsDb = {
  issueTopic: {
    findMany: (args?: Record<string, unknown>) => Promise<unknown[]>
  }
}

const AdminIssueTopicsPage: NextPageWithLayout<Props> = ({ topics }) => {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Issue Topics</h1>
        <Link
          href="/admin/issue-topics/new"
          className="rounded-lg bg-amber px-4 py-2 text-sm font-semibold text-navy no-underline hover:bg-amber/80"
        >
          New topic
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Title</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Order</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Recs</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Logged by members</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Created</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {topics.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                  No issue topics yet. Create one to get started.
                </td>
              </tr>
            )}
            {topics.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-navy">{t.title}</div>
                  <div className="text-xs text-slate-400">{t.slug}</div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{t.order}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                      t.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {t.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{t._count.recommendationMaps}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{t._count.memberIssues}</td>
                <td className="px-4 py-3 text-sm text-slate-400">
                  {new Date(t.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/issue-topics/${t.id}`}
                    className="text-sm font-semibold text-navy no-underline hover:text-amber"
                  >
                    Manage
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

AdminIssueTopicsPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions)
  if (!session) return { redirect: { destination: "/signin", permanent: false } }
  if (!["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole ?? ""))
    return { redirect: { destination: "/dashboard", permanent: false } }

  const db_ = db as never as IssueTopicsDb
  const topics = await db_.issueTopic.findMany({
    orderBy: { order: "asc" },
    include: {
      _count: { select: { memberIssues: true, recommendationMaps: true } },
    },
  })

  return { props: { topics: JSON.parse(JSON.stringify(topics)) } }
}

export default AdminIssueTopicsPage

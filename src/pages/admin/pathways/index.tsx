import type { NextPageWithLayout } from "@/types/next"
import type { GetServerSideProps } from "next"
import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { AdminLayout } from "@/components/layout/AdminLayout"

type PathwayRow = {
  id: string
  title: string
  slug: string
  summary: string
  estimatedDays: number
  active: boolean
  createdAt: string
  _count: { stages: number; enrollments: number }
}

type Props = { pathways: PathwayRow[] }

type PathwaysDb = {
  growthPathway: {
    findMany: (args?: Record<string, unknown>) => Promise<unknown[]>
  }
}

const AdminPathwaysPage: NextPageWithLayout<Props> = ({ pathways }) => {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Growth Pathways</h1>
        <Link
          href="/admin/pathways/new"
          className="rounded-lg bg-amber px-4 py-2 text-sm font-semibold text-navy no-underline hover:bg-amber/80"
        >
          New pathway
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Title</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Stages</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Days</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Enrolled</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Created</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pathways.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                  No pathways yet. Create one to get started.
                </td>
              </tr>
            )}
            {pathways.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-navy">{p.title}</div>
                  <div className="text-xs text-slate-400">{p.slug}</div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{p._count.stages}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{p.estimatedDays}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{p._count.enrollments}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                      p.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {p.active ? "Active" : "Archived"}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-400">
                  {new Date(p.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/pathways/${p.id}`}
                    className="text-sm font-semibold text-navy no-underline hover:text-amber"
                  >
                    Edit
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

AdminPathwaysPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions)
  if (!session) return { redirect: { destination: "/signin", permanent: false } }
  if (!["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole ?? ""))
    return { redirect: { destination: "/dashboard", permanent: false } }

  const db_ = db as never as PathwaysDb
  const pathways = await db_.growthPathway.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { stages: true, enrollments: true } } },
  })

  return { props: { pathways: JSON.parse(JSON.stringify(pathways)) } }
}

export default AdminPathwaysPage

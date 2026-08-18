import type { NextPageWithLayout } from "@/types/next"
import type { GetServerSideProps } from "next"
import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { AdminLayout } from "@/components/layout/AdminLayout"

type ChallengeRow = {
  id: string
  title: string
  slug: string
  summary: string
  durationDays: number
  active: boolean
  startMode: string
  loyaltyPoints: number
  createdAt: string
  _count: { steps: number; enrollments: number }
}

type Props = { challenges: ChallengeRow[] }

type ChallengesDb = {
  challenge: {
    findMany: (args?: Record<string, unknown>) => Promise<unknown[]>
  }
}

const AdminChallengesPage: NextPageWithLayout<Props> = ({ challenges }) => {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Fixer Challenges</h1>
        <Link
          href="/admin/challenges/new"
          className="rounded-lg bg-amber px-4 py-2 text-sm font-semibold text-navy no-underline hover:bg-amber/80"
        >
          New challenge
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Title</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Steps</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Days</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Enrolled</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Mode</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Points</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Created</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {challenges.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-400">
                  No challenges yet. Create one to get started.
                </td>
              </tr>
            )}
            {challenges.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-navy">{c.title}</div>
                  <div className="text-xs text-slate-400">{c.slug}</div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{c._count.steps}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{c.durationDays}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{c._count.enrollments}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{c.startMode === "EVERGREEN" ? "Evergreen" : "Scheduled"}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{c.loyaltyPoints}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                      c.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {c.active ? "Active" : "Archived"}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-400">
                  {new Date(c.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/challenges/${c.id}`}
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

AdminChallengesPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions)
  if (!session) return { redirect: { destination: "/signin", permanent: false } }
  if (!["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole ?? ""))
    return { redirect: { destination: "/dashboard", permanent: false } }

  const db_ = db as never as ChallengesDb
  const challenges = await db_.challenge.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { steps: true, enrollments: true } } },
  })

  return { props: { challenges: JSON.parse(JSON.stringify(challenges)) } }
}

export default AdminChallengesPage

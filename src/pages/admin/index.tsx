import Link from "next/link";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { UserRole } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

interface Stats {
  totalUsers: number;
  activeMembers: number;
  activeProducts: number;
  newThisWeek: number;
}

interface RecentUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
}

interface Props {
  stats: Stats;
  recentUsers: RecentUser[];
}

const QUICK_ACTIONS = [
  { label: "+ New Product", href: "/admin/products/new", primary: true },
  { label: "Manage Users", href: "/admin/users", primary: false },
  { label: "Site Settings", href: "/admin/settings", primary: false },
  { label: "View Site ↗", href: "/", primary: false, external: true },
];

const AdminDashboard: NextPageWithLayout<Props> = ({ stats, recentUsers }) => {
  const statCards = [
    { label: "Total Users", value: stats.totalUsers },
    { label: "Active Members", value: stats.activeMembers },
    { label: "Active Products", value: stats.activeProducts },
    { label: "New This Week", value: stats.newThisWeek },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Fixer Nation overview.</p>
      </div>

      {/* Quick actions */}
      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          {QUICK_ACTIONS.map((a) =>
            a.external ? (
              <a
                key={a.label}
                href={a.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 no-underline transition-colors hover:bg-slate-50"
              >
                {a.label}
              </a>
            ) : (
              <Link
                key={a.label}
                href={a.href}
                className={[
                  "rounded-lg px-4 py-2 text-sm font-semibold no-underline transition-colors",
                  a.primary
                    ? "bg-navy text-white hover:bg-navy-dark"
                    : "border border-slate-300 text-slate-700 hover:bg-slate-50",
                ].join(" ")}
              >
                {a.label}
              </Link>
            )
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {card.label}
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Recent sign-ups */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-700">Recent Sign-ups</h2>
          <Link
            href="/admin/users"
            className="text-xs font-medium text-navy no-underline hover:text-navy-dark"
          >
            View all →
          </Link>
        </div>
        {recentUsers.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">No users yet.</p>
        ) : (
          <table className="min-w-full divide-y divide-slate-100">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Role
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Joined
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {recentUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-slate-900">{user.name ?? "—"}</p>
                    <p className="text-xs text-slate-400">{user.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-navy/10 px-2 py-0.5 text-xs font-medium text-navy">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

AdminDashboard.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return { redirect: { destination: "/signin", permanent: false } };
  }

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const PAID_ROLES: UserRole[] = [
    UserRole.MEMBER,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.AMBASSADOR,
    UserRole.PROVIDER,
  ];

  try {
    const [totalUsers, activeMembers, activeProducts, newThisWeek, recentUsers] =
      await Promise.all([
        db.user.count(),
        db.user.count({ where: { role: { in: PAID_ROLES } } }),
        db.product.count({ where: { active: true } }),
        db.user.count({ where: { createdAt: { gte: weekAgo } } }),
        db.user.findMany({
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, name: true, email: true, role: true, createdAt: true },
        }),
      ]);

    return {
      props: {
        stats: { totalUsers, activeMembers, activeProducts, newThisWeek },
        recentUsers: JSON.parse(JSON.stringify(recentUsers)),
      },
    };
  } catch (e) {
    console.error("[admin/dashboard] getServerSideProps error:", e);
    return {
      props: {
        stats: { totalUsers: 0, activeMembers: 0, activeProducts: 0, newThisWeek: 0 },
        recentUsers: [],
      },
    };
  }
};

export default AdminDashboard;

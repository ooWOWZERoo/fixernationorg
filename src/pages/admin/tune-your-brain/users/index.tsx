import Head from "next/head";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];
const PAGE_SIZE = 25;

interface UserRow {
  id: string;
  name: string | null;
  email: string;
  role: string;
  sessionCount: number;
}

interface Props {
  users: UserRow[];
  total: number;
  q: string;
}

const AdminTuneBrainUsersPage: NextPageWithLayout<Props> = ({ users, total, q: initialQ }) => {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setQ(initialQ); }, [initialQ]);

  function handleSearchChange(val: string) {
    setQ(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (val) params.set("q", val);
      router.push(`/admin/tune-your-brain/users${params.toString() ? `?${params}` : ""}`);
    }, 400);
  }

  return (
    <>
      <Head><title>Member Progress — Tune Your Brain — Admin</title></Head>
      <div className="mb-6">
        <Link href="/admin/tune-your-brain/content" className="text-sm text-slate-500 no-underline hover:text-navy">
          ← Tune Your Brain
        </Link>
        <h1 className="mt-2 text-2xl font-extrabold text-navy">Member progress &amp; resets</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Look up a member&apos;s Tune Your Brain record, and reset their progress if needed.
        </p>
      </div>

      <div className="mb-4">
        <label htmlFor="tb-member-search" className="sr-only">
          Search members by name, email, or user ID
        </label>
        <input
          id="tb-member-search"
          type="text"
          value={q}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search by name, email, or user ID..."
          className="w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-navy"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">TYB Sessions</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-400">
                    {q ? "No members match that search." : "Search for a member by name, email, or ID."}
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-700">{u.name ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{u.email}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{u.role}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{u.sessionCount}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/tune-your-brain/users/${u.id}`} className="text-sm font-medium text-navy no-underline hover:text-navy-dark">
                        View record
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {q && total > PAGE_SIZE && (
        <p className="mt-3 text-xs text-slate-400">Showing the first {PAGE_SIZE} of {total} matches. Refine your search to narrow this down.</p>
      )}
    </>
  );
};

AdminTuneBrainUsersPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.adminRole || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return { redirect: { destination: `/signin?callbackUrl=${encodeURIComponent(ctx.resolvedUrl)}`, permanent: false } };
  }

  const q = typeof ctx.query.q === "string" ? ctx.query.q.trim() : "";

  if (!q) {
    return { props: { users: [], total: 0, q } };
  }

  const where = {
    OR: [
      { email: { contains: q, mode: "insensitive" as const } },
      { name: { contains: q, mode: "insensitive" as const } },
      { id: q },
    ],
  };

  const [rows, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        _count: { select: { tbGameSessions: true } },
      },
    }),
    db.user.count({ where }),
  ]);

  return {
    props: {
      users: rows.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        sessionCount: u._count.tbGameSessions,
      })),
      total,
      q,
    },
  };
};

export default AdminTuneBrainUsersPage;

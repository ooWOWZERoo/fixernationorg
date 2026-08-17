import { useState, useCallback } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

const ROLE_BADGE: Record<string, string> = {
  CONSUMER: "bg-slate-100 text-slate-600",
  MEMBER: "bg-navy/10 text-navy",
  PROVIDER: "bg-sky-100 text-sky-700",
  AMBASSADOR: "bg-violet-100 text-violet-700",
  ADMIN: "bg-amber/15 text-amber-dark",
  SUPER_ADMIN: "bg-amber/30 text-amber-dark font-bold",
};

interface UserRow {
  id: string;
  name: string | null;
  email: string;
  role: string;
  total: number;
  lastAt: string | null;
}

interface Props {
  users: UserRow[];
  total: number;
  pages: number;
  page: number;
  search: string;
  grandTotal: number;
}

const AdminLoyaltyPage: NextPageWithLayout<Props> = ({ users: initialUsers, total, pages, page, search: initialSearch, grandTotal }) => {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState(initialSearch);
  const [currentPage, setCurrentPage] = useState(page);
  const [totalUsers, setTotalUsers] = useState(total);
  const [totalPages, setTotalPages] = useState(pages);
  const [loading, setLoading] = useState(false);

  const [awardingId, setAwardingId] = useState<string | null>(null);
  const [awardForm, setAwardForm] = useState({ points: "", note: "" });
  const [awardSaving, setAwardSaving] = useState(false);
  const [awardMsg, setAwardMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchUsers = useCallback(async (q: string, p: number) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p) });
    if (q) params.set("search", q);
    const res = await fetch(`/api/admin/loyalty?${params}`);
    const data = await res.json();
    setUsers(data.users);
    setTotalUsers(data.total);
    setTotalPages(data.pages);
    setCurrentPage(data.page);
    setLoading(false);
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchUsers(search, 1);
  }

  async function handleAward(e: React.FormEvent, userId: string) {
    e.preventDefault();
    setAwardSaving(true);
    setAwardMsg(null);
    const pts = parseInt(awardForm.points);
    if (!pts || pts < 1 || pts > 1000) {
      setAwardMsg({ ok: false, text: "Enter a number between 1 and 1000." });
      setAwardSaving(false);
      return;
    }
    const res = await fetch("/api/admin/loyalty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, points: pts, note: awardForm.note }),
    });
    const data = await res.json();
    if (!res.ok) {
      setAwardMsg({ ok: false, text: data.error ?? "Something went wrong." });
    } else {
      setAwardMsg({ ok: true, text: `${pts} pts awarded.` });
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, total: u.total + pts, lastAt: new Date().toISOString() }
            : u
        )
      );
      setTimeout(() => {
        setAwardingId(null);
        setAwardForm({ points: "", note: "" });
        setAwardMsg(null);
      }, 1500);
    }
    setAwardSaving(false);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy">Loyalty points</h1>
          <p className="mt-0.5 text-sm text-ink-soft">{totalUsers.toLocaleString()} members &middot; {grandTotal.toLocaleString()} pts awarded total</p>
        </div>
      </div>

      <form onSubmit={handleSearch} className="mb-6 flex gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email"
          className="flex-1 rounded-lg border border-navy/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
        />
        <button
          type="submit"
          className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-dark"
        >
          Search
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-ink-soft">Loading...</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-ink-soft">No users found.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-navy/10 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy/8 text-left text-xs font-bold uppercase tracking-widest text-ink-soft">
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3 text-right">Points</th>
                <th className="px-4 py-3">Last earned</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/8">
              {users.map((u) => (
                <>
                  <tr key={u.id} className="hover:bg-navy/2">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-navy">{u.name ?? "—"}</p>
                      <p className="text-xs text-ink-soft">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ROLE_BADGE[u.role] ?? "bg-slate-100 text-slate-600"}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-navy">
                      {u.total.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-soft">
                      {u.lastAt
                        ? new Date(u.lastAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : "Never"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          setAwardingId(awardingId === u.id ? null : u.id);
                          setAwardForm({ points: "", note: "" });
                          setAwardMsg(null);
                        }}
                        className="rounded-lg border border-navy/20 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-navy/5"
                      >
                        {awardingId === u.id ? "Cancel" : "Award points"}
                      </button>
                    </td>
                  </tr>
                  {awardingId === u.id && (
                    <tr key={`${u.id}-award`}>
                      <td colSpan={5} className="bg-navy/2 px-4 py-4">
                        <form onSubmit={(e) => handleAward(e, u.id)} className="flex flex-wrap items-end gap-3">
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-navy">Points</label>
                            <input
                              type="number"
                              min={1}
                              max={1000}
                              value={awardForm.points}
                              onChange={(e) => setAwardForm((f) => ({ ...f, points: e.target.value }))}
                              placeholder="e.g. 25"
                              className="w-24 rounded-lg border border-navy/20 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                              required
                            />
                          </div>
                          <div className="flex-1 min-w-[180px]">
                            <label className="mb-1 block text-xs font-semibold text-navy">Note</label>
                            <input
                              type="text"
                              maxLength={200}
                              value={awardForm.note}
                              onChange={(e) => setAwardForm((f) => ({ ...f, note: e.target.value }))}
                              placeholder="Reason for the award"
                              className="w-full rounded-lg border border-navy/20 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                              required
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={awardSaving}
                            className="rounded-lg bg-navy px-4 py-1.5 text-sm font-semibold text-white hover:bg-navy-dark disabled:opacity-50"
                          >
                            {awardSaving ? "Saving..." : "Award"}
                          </button>
                          {awardMsg && (
                            <p className={`text-sm font-semibold ${awardMsg.ok ? "text-green-700" : "text-red-600"}`}>
                              {awardMsg.text}
                            </p>
                          )}
                        </form>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => fetchUsers(search, currentPage - 1)}
            disabled={currentPage <= 1 || loading}
            className="rounded-lg border border-navy/20 px-3 py-1.5 text-sm font-semibold text-navy hover:bg-navy/5 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-ink-soft">Page {currentPage} of {totalPages}</span>
          <button
            onClick={() => fetchUsers(search, currentPage + 1)}
            disabled={currentPage >= totalPages || loading}
            className="rounded-lg border border-navy/20 px-3 py-1.5 text-sm font-semibold text-navy hover:bg-navy/5 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

AdminLoyaltyPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole ?? "")) {
    return { redirect: { destination: "/admin", permanent: false } };
  }

  const search = typeof context.query.search === "string" ? context.query.search.trim() : "";
  const page = Math.max(1, parseInt(context.query.page as string) || 1);
  const PAGE_SIZE = 50;

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [users, total, grandTotalResult] = await Promise.all([
    db.user.findMany({
      where,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    }),
    db.user.count({ where }),
    db.loyaltyPoint.aggregate({ _sum: { points: true } }),
  ]);

  const userIds = users.map((u) => u.id);
  const pointGroups = await db.loyaltyPoint.groupBy({
    by: ["userId"],
    where: { userId: { in: userIds } },
    _sum: { points: true },
    _max: { createdAt: true },
  });

  const pointMap: Record<string, { total: number; lastAt: string | null }> = {};
  for (const g of pointGroups) {
    pointMap[g.userId] = {
      total: g._sum.points ?? 0,
      lastAt: g._max.createdAt ? g._max.createdAt.toISOString() : null,
    };
  }

  return {
    props: {
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        total: pointMap[u.id]?.total ?? 0,
        lastAt: pointMap[u.id]?.lastAt ?? null,
      })),
      total,
      page,
      pages: Math.ceil(total / PAGE_SIZE),
      search,
      grandTotal: grandTotalResult._sum.points ?? 0,
    },
  };
};

export default AdminLoyaltyPage;

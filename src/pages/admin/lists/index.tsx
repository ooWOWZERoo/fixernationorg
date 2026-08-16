import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

interface ListRow {
  id: string;
  name: string;
  description: string | null;
  ownerType: string;
  memberCount: number;
  createdAt: string;
}

interface Props { lists: ListRow[] }

const AdminListsPage: NextPageWithLayout<Props> = ({ lists }) => {
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [allLists, setAllLists] = useState(lists);

  async function createList(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, ownerType: "FN_ADMIN" }),
      });
      if (!res.ok) throw new Error("Failed");
      const created = await res.json();
      setAllLists((l) => [{ ...created, memberCount: 0, createdAt: created.createdAt }, ...l]);
      setForm({ name: "", description: "" });
      setShowNew(false);
    } finally { setSaving(false); }
  }

  return (
    <>
      <Head><title>Contact Lists — Admin</title></Head>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-navy">Contact lists</h1>
        <button onClick={() => setShowNew(true)}
          className="rounded-xl bg-amber px-4 py-2 text-sm font-bold text-navy-dark hover:bg-amber-dark">
          + New list
        </button>
      </div>

      {showNew && (
        <form onSubmit={createList} className="mb-6 rounded-2xl border border-navy/15 bg-white p-5">
          <h2 className="mb-4 text-sm font-bold text-navy">New list</h2>
          <div className="mb-3">
            <input required type="text" placeholder="List name" value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
          </div>
          <div className="mb-3">
            <input type="text" placeholder="Description (optional)" value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="rounded-xl bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-navy-dark disabled:opacity-60">
              {saving ? "Saving…" : "Create list"}
            </button>
            <button type="button" onClick={() => setShowNew(false)}
              className="rounded-xl border border-navy/15 px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-cream-panel">
              Cancel
            </button>
          </div>
        </form>
      )}

      {allLists.length === 0 ? (
        <div className="rounded-2xl border border-navy/8 bg-white p-12 text-center">
          <p className="text-sm text-ink-soft">No lists yet. Create one to start segmenting contacts.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {allLists.map((l) => (
            <Link key={l.id} href={`/admin/lists/${l.id}`}
              className="block rounded-2xl border border-navy/8 bg-white p-5 no-underline hover:border-navy/20 hover:shadow-sm transition">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-semibold text-navy">{l.name}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  l.ownerType === "FN_ADMIN" ? "bg-navy/8 text-navy" :
                  l.ownerType === "AMBASSADOR" ? "bg-amber/20 text-amber-dark" :
                  "bg-green-100 text-green-800"
                }`}>{l.ownerType.replace("_", " ").toLowerCase()}</span>
              </div>
              {l.description && <p className="mb-2 text-sm text-ink-soft">{l.description}</p>}
              <p className="text-xs text-ink-soft">{l.memberCount} contact{l.memberCount !== 1 ? "s" : ""}</p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
};

AdminListsPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;
export default AdminListsPage;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return { redirect: { destination: "/", permanent: false } };
  }

  const lists = await db.contactList.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { members: true } } },
  });

  return {
    props: {
      lists: lists.map((l) => ({
        id: l.id,
        name: l.name,
        description: l.description,
        ownerType: l.ownerType,
        memberCount: l._count.members,
        createdAt: l.createdAt.toISOString(),
      })),
    },
  };
};

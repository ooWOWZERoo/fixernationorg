import type { NextPageWithLayout } from "@/types/next";
import { GetServerSideProps } from "next";
import { useState } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";

type TopicWithCount = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { subscriptions: number };
};

interface Props {
  topics: TopicWithCount[];
}

const NewsletterTopicsPage: NextPageWithLayout<Props> = ({ topics: initial }) => {
  const [topics, setTopics] = useState(initial);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    setError("");
    try {
      const r = await fetch("/api/admin/newsletter-topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || undefined }),
      });
      if (r.ok) {
        const topic = await r.json();
        setTopics((prev) => [...prev, { ...topic, _count: { subscriptions: 0 } }]);
        setNewName("");
        setNewDesc("");
        setCreating(false);
      } else {
        const data = await r.json();
        setError(data.error ?? "Failed to create topic");
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    const r = await fetch(`/api/admin/newsletter-topics/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    if (r.ok) {
      setTopics((prev) => prev.map((t) => (t.id === id ? { ...t, active } : t)));
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    const r = await fetch(`/api/admin/newsletter-topics/${id}`, { method: "DELETE" });
    if (r.ok) {
      setTopics((prev) => prev.filter((t) => t.id !== id));
    } else {
      const data = await r.json();
      alert(data.error ?? "Delete failed");
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Newsletter Topics</h1>
          <p className="text-sm text-gray-500 mt-1">Manage subscription topics contacts can opt into</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          New Topic
        </button>
      </div>

      {creating && (
        <form onSubmit={handleCreate} className="mb-6 bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">New topic</h2>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Name *</label>
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              placeholder="e.g. Weekly Roundup"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-400 mt-1">Slug will be auto-generated from the name</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Description</label>
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="What subscribers get with this topic"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Create"}
            </button>
            <button
              type="button"
              onClick={() => { setCreating(false); setError(""); }}
              className="text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {topics.length === 0 && !creating ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No topics yet</p>
          <p className="text-sm mt-1">Create your first topic to start building subscription lists</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Slug</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subscribers</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {topics.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">{t.name}</p>
                    {t.description && <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>}
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-gray-500">{t.slug}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{t._count.subscriptions.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleActive(t.id, !t.active)}
                      className={[
                        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                        t.active
                          ? "bg-green-100 text-green-800 hover:bg-green-200"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200",
                      ].join(" ")}
                    >
                      {t.active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right text-sm">
                    <button
                      onClick={() => handleDelete(t.id, t.name)}
                      disabled={t._count.subscriptions > 0}
                      className="text-red-500 hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                      title={t._count.subscriptions > 0 ? "Has active subscribers" : undefined}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
};

NewsletterTopicsPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return { redirect: { destination: "/signin", permanent: false } };
  }

  const topics = await db.newsletterTopic.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { subscriptions: true } } },
  });

  return {
    props: {
      topics: topics.map((t: { createdAt: Date; updatedAt: Date; [k: string]: unknown }) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
    },
  };
};

export default NewsletterTopicsPage;

import type { NextPageWithLayout } from "@/types/next";
import type { EmailTemplate } from "@prisma/client";
import { GetServerSideProps } from "next";
import Link from "next/link";
import { useState } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";

type TemplateWithCount = EmailTemplate & { _count: { campaigns: number } };

interface Props {
  templates: TemplateWithCount[];
}

const EmailTemplatesPage: NextPageWithLayout<Props> = ({ templates: initial }) => {
  const [templates, setTemplates] = useState(initial);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      const r = await fetch(`/api/admin/email-templates/${id}`, { method: "DELETE" });
      if (r.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
      } else {
        alert("Delete failed.");
      }
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Templates</h1>
          <p className="text-sm text-gray-500 mt-1">Reusable templates for campaign emails</p>
        </div>
        <Link
          href="/admin/email-templates/new"
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          New Template
        </Link>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No templates yet</p>
          <p className="text-sm mt-1">Create your first template to get started</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Used in</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Updated</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {templates.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{t.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">{t.subject}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {t._count.campaigns === 0 ? (
                      <span className="text-gray-400">—</span>
                    ) : (
                      <span>{t._count.campaigns} campaign{t._count.campaigns !== 1 ? "s" : ""}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(t.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="px-6 py-4 text-right text-sm space-x-3">
                    <Link href={`/admin/email-templates/${t.id}`} className="text-indigo-600 hover:underline">
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(t.id, t.name)}
                      disabled={deleting === t.id || t._count.campaigns > 0}
                      className="text-red-500 hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                      title={t._count.campaigns > 0 ? "In use by campaigns" : undefined}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

EmailTemplatesPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return { redirect: { destination: "/signin", permanent: false } };
  }

  const templates = await db.emailTemplate.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { campaigns: true } } },
  });

  return {
    props: {
      templates: templates.map((t) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
    },
  };
};

export default EmailTemplatesPage;

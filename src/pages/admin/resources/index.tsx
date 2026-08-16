import Link from "next/link";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

interface ResourceRow {
  id: string;
  slug: string;
  title: string;
  type: string | null;
  publishedAt: string | null;
  createdAt: string;
}

interface Props {
  resources: ResourceRow[];
}

const AdminResourcesPage: NextPageWithLayout<Props> = ({ resources }) => {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Resources</h1>
          <p className="mt-1 text-sm text-slate-500">Manage member-only guides, worksheets, and tools.</p>
        </div>
        <Link
          href="/admin/resources/new"
          className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white no-underline hover:bg-navy-dark transition-colors"
        >
          + New Resource
        </Link>
      </div>

      {resources.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-sm font-medium text-slate-500">No resources yet.</p>
          <p className="mt-1 text-sm text-slate-400">Create the first guide, worksheet, or tool.</p>
          <Link
            href="/admin/resources/new"
            className="mt-4 inline-flex items-center gap-1 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white no-underline hover:bg-navy-dark"
          >
            + New Resource
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Title</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Published</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {resources.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{r.title}</p>
                      <p className="text-xs text-slate-400">{r.slug}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">{r.type ?? "—"}</td>
                  <td className="px-4 py-3">
                    {r.publishedAt ? (
                      <span className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                        Published
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                        Draft
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {r.publishedAt
                      ? new Date(r.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/resources/${r.id}`}
                      className="text-sm font-medium text-navy no-underline hover:text-navy-dark"
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
      )}
    </div>
  );
};

AdminResourcesPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return { redirect: { destination: `/signin?callbackUrl=${encodeURIComponent(context.resolvedUrl)}`, permanent: false } };
  }

  const resources = await db.resource.findMany({
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: { id: true, slug: true, title: true, type: true, publishedAt: true, createdAt: true },
  });

  return { props: { resources: JSON.parse(JSON.stringify(resources)) } };
};

export default AdminResourcesPage;

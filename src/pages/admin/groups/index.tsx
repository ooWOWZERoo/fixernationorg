import Link from "next/link";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

type GroupRow = {
  id: string;
  name: string;
  slug: string;
  visibility: string;
  autoMember: boolean;
  autoAmbassador: boolean;
  autoProvider: boolean;
  memberCount: number;
  postCount: number;
  pendingRequests: number;
  createdAt: string;
};

interface Props {
  groups: GroupRow[];
}

const VISIBILITY_LABEL: Record<string, string> = { PUBLIC: "Public", PRIVATE: "Private" };

function autoJoinLabel(g: Pick<GroupRow, "autoMember" | "autoAmbassador" | "autoProvider">) {
  const tags = [
    g.autoMember && "Members",
    g.autoAmbassador && "Ambassadors",
    g.autoProvider && "Providers",
  ].filter(Boolean) as string[];
  return tags.length ? tags.join(", ") : null;
}

const AdminGroupsPage: NextPageWithLayout<Props> = ({ groups }) => (
  <div>
    <div className="mb-6 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Groups</h1>
        <p className="mt-1 text-sm text-slate-500">Manage FN Network community groups.</p>
      </div>
      <Link
        href="/admin/groups/new"
        className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white no-underline hover:bg-navy-dark transition-colors"
      >
        + New Group
      </Link>
    </div>

    {groups.length === 0 ? (
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
        <p className="text-sm font-medium text-slate-500">No groups yet.</p>
        <p className="mt-1 text-sm text-slate-400">Create your first community group to get started.</p>
        <Link
          href="/admin/groups/new"
          className="mt-4 inline-flex items-center gap-1 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white no-underline hover:bg-navy-dark"
        >
          + New Group
        </Link>
      </div>
    ) : (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Visibility</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Members</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Posts</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Pending</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {groups.map((g) => (
              <tr key={g.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{g.name}</p>
                    <p className="text-xs text-slate-400">{g.slug}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {autoJoinLabel(g) ? (
                    <span className="inline-flex rounded-full bg-navy/10 px-2.5 py-0.5 text-xs font-medium text-navy">
                      Auto: {autoJoinLabel(g)}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">General</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">{VISIBILITY_LABEL[g.visibility] ?? g.visibility}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{g.memberCount}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{g.postCount}</td>
                <td className="px-4 py-3">
                  {g.pendingRequests > 0 ? (
                    <Link
                      href={`/admin/groups/${g.id}/requests`}
                      className="inline-flex items-center gap-1 rounded-full bg-amber/20 px-2.5 py-0.5 text-xs font-semibold text-amber-dark no-underline hover:bg-amber/30"
                    >
                      {g.pendingRequests} pending
                    </Link>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Link
                      href={`/network/groups/${g.slug}`}
                      className="text-xs font-medium text-ink-soft no-underline hover:text-navy"
                    >
                      View
                    </Link>
                    <Link
                      href={`/admin/groups/${g.id}`}
                      className="text-sm font-medium text-navy no-underline hover:text-navy-dark"
                    >
                      Edit
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

AdminGroupsPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return { redirect: { destination: `/signin?callbackUrl=${encodeURIComponent(context.resolvedUrl)}`, permanent: false } };
  }

  const groups = await db.socialGroup.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { members: true, posts: true } },
      requests: { where: { status: "PENDING" }, select: { id: true } },
    },
  });

  return {
    props: {
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        slug: g.slug,
        visibility: g.visibility,
        autoMember: g.autoMember,
        autoAmbassador: g.autoAmbassador,
        autoProvider: g.autoProvider,
        memberCount: g._count.members,
        postCount: g._count.posts,
        pendingRequests: g.requests.length,
        createdAt: g.createdAt.toISOString(),
      })),
    },
  };
};

export default AdminGroupsPage;

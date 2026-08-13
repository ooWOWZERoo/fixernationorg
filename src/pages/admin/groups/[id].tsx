import Link from "next/link";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { GroupForm } from "@/components/admin/GroupForm";
import type { NextPageWithLayout } from "@/types/next";

interface Props {
  group: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    coverUrl: string | null;
    type: string;
    visibility: string;
  };
  pendingCount: number;
}

const AdminGroupEditPage: NextPageWithLayout<Props> = ({ group, pendingCount }) => (
  <div>
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{group.name}</h1>
        <p className="mt-1 text-sm text-slate-500">Edit group details and settings.</p>
      </div>
      {pendingCount > 0 && (
        <Link
          href={`/admin/groups/${group.id}/requests`}
          className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-amber/20 px-3 py-2 text-sm font-semibold text-amber-dark no-underline hover:bg-amber/30"
        >
          {pendingCount} join request{pendingCount !== 1 ? "s" : ""} pending
        </Link>
      )}
    </div>

    <GroupForm
      mode="edit"
      groupId={group.id}
      initial={{
        name: group.name,
        slug: group.slug,
        description: group.description ?? "",
        coverUrl: group.coverUrl ?? "",
        type: group.type,
        visibility: group.visibility,
      }}
    />
  </div>
);

AdminGroupEditPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return { redirect: { destination: `/signin?callbackUrl=${encodeURIComponent(context.resolvedUrl)}`, permanent: false } };
  }

  const id = context.params?.id as string;
  const group = await db.socialGroup.findUnique({
    where: { id },
    include: { requests: { where: { status: "PENDING" }, select: { id: true } } },
  });
  if (!group) return { notFound: true };

  return {
    props: {
      group: {
        id: group.id,
        name: group.name,
        slug: group.slug,
        description: group.description,
        coverUrl: group.coverUrl,
        type: group.type,
        visibility: group.visibility,
      },
      pendingCount: group.requests.length,
    },
  };
};

export default AdminGroupEditPage;

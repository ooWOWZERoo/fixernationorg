import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { GroupForm } from "@/components/admin/GroupForm";
import type { NextPageWithLayout } from "@/types/next";

const AdminGroupNewPage: NextPageWithLayout = () => (
  <div>
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-slate-900">New Group</h1>
      <p className="mt-1 text-sm text-slate-500">Create a new FN Network community group.</p>
    </div>
    <GroupForm mode="create" />
  </div>
);

AdminGroupNewPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return { redirect: { destination: `/signin?callbackUrl=${encodeURIComponent(context.resolvedUrl)}`, permanent: false } };
  }
  return { props: {} };
};

export default AdminGroupNewPage;

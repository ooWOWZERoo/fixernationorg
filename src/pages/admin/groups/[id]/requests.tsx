import { useState } from "react";
import Link from "next/link";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

interface RequestRow {
  id: string;
  message: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string; createdAt: string };
}

interface Props {
  groupId: string;
  groupName: string;
  initialRequests: RequestRow[];
}

const AdminGroupRequestsPage: NextPageWithLayout<Props> = ({ groupId, groupName, initialRequests }) => {
  const [requests, setRequests] = useState(initialRequests);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function review(requestId: string, action: "APPROVE" | "REJECT") {
    setBusy(requestId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/groups/${groupId}/requests`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Link href="/admin/groups" className="no-underline hover:text-navy">Groups</Link>
          <span>/</span>
          <Link href={`/admin/groups/${groupId}`} className="no-underline hover:text-navy">{groupName}</Link>
          <span>/</span>
          <span>Join Requests</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Join Requests</h1>
        <p className="mt-1 text-sm text-slate-500">
          {requests.length > 0
            ? `${requests.length} pending request${requests.length !== 1 ? "s" : ""} for ${groupName}.`
            : `No pending requests for ${groupName}.`}
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {requests.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-sm text-slate-400">No pending requests.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Member</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Message</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Requested</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-slate-900">{r.user.name ?? "—"}</p>
                    <p className="text-xs text-slate-400">{r.user.email}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 max-w-xs">
                    {r.message ?? <span className="text-slate-400 italic">No message</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => review(r.id, "APPROVE")}
                        disabled={busy === r.id}
                        className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-navy-dark disabled:opacity-40"
                      >
                        {busy === r.id ? "…" : "Approve"}
                      </button>
                      <button
                        onClick={() => review(r.id, "REJECT")}
                        disabled={busy === r.id}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-40"
                      >
                        Reject
                      </button>
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
};

AdminGroupRequestsPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return { redirect: { destination: `/signin?callbackUrl=${encodeURIComponent(context.resolvedUrl)}`, permanent: false } };
  }

  const groupId = context.params?.id as string;
  const group = await db.socialGroup.findUnique({
    where: { id: groupId },
    include: {
      requests: {
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
      },
    },
  });
  if (!group) return { notFound: true };

  return {
    props: {
      groupId: group.id,
      groupName: group.name,
      initialRequests: group.requests.map((r) => ({
        id: r.id,
        message: r.message,
        createdAt: r.createdAt.toISOString(),
        user: { ...r.user, createdAt: r.user.createdAt.toISOString() },
      })),
    },
  };
};

export default AdminGroupRequestsPage;

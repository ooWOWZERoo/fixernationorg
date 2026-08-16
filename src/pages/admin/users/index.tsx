import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { useSession } from "next-auth/react";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

const ALL_ROLES = [
  "CONSUMER",
  "MEMBER",
  "PROVIDER",
  "AMBASSADOR",
  "ADMIN",
  "SUPER_ADMIN",
] as const;

const ROLE_LABEL: Record<string, string> = {
  CONSUMER: "Consumer",
  MEMBER: "Member",
  PROVIDER: "Service Provider",
  AMBASSADOR: "Brand Ambassador",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super Admin",
};

interface UserRow {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
}

interface Props {
  users: UserRow[];
}

const AdminUsersPage: NextPageWithLayout<Props> = ({ users: initialUsers }) => {
  const { data: session } = useSession();
  const [users, setUsers] = useState(initialUsers);
  const [saving, setSaving] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    id: string;
    ok: boolean;
    msg: string;
  } | null>(null);

  async function updateRole(userId: string, role: string) {
    setSaving(userId);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ id: userId, ok: false, msg: data.error ?? "Failed" });
      } else {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role } : u))
        );
        setFeedback({ id: userId, ok: true, msg: "Saved" });
        setTimeout(() => setFeedback(null), 2500);
      }
    } catch {
      setFeedback({ id: userId, ok: false, msg: "Network error" });
    } finally {
      setSaving(null);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Users</h1>
        <p className="mt-1 text-sm text-slate-500">
          {users.length} registered user{users.length !== 1 ? "s" : ""}.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                User
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Joined
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => {
              const isMe = user.id === session?.user?.id;
              const targetIsSuperAdmin = user.role === "SUPER_ADMIN";
              const iAmSuperAdmin = session?.user?.role === "SUPER_ADMIN";
              const canEdit = !isMe && !(targetIsSuperAdmin && !iAmSuperAdmin);
              const fb = feedback?.id === user.id ? feedback : null;

              return (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-slate-900">
                      {user.name ?? "—"}
                    </p>
                    <p className="text-xs text-slate-400">{user.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {canEdit ? (
                        <select
                          value={user.role}
                          disabled={saving === user.id}
                          onChange={(e) => updateRole(user.id, e.target.value)}
                          className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 focus:border-navy focus:outline-none disabled:opacity-50"
                        >
                          {ALL_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABEL[r] ?? r}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="inline-flex rounded-full bg-navy/10 px-2.5 py-0.5 text-xs font-medium text-navy">
                          {ROLE_LABEL[user.role] ?? user.role}
                        </span>
                      )}
                      {saving === user.id && (
                        <span className="text-xs text-slate-400">Saving…</span>
                      )}
                      {fb && (
                        <span
                          className={`text-xs ${fb.ok ? "text-green-600" : "text-red-500"}`}
                        >
                          {fb.msg}
                        </span>
                      )}
                      {isMe && (
                        <span className="text-xs text-slate-400">(you)</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
};

AdminUsersPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return { redirect: { destination: `/signin?callbackUrl=${encodeURIComponent(context.resolvedUrl)}`, permanent: false } };
  }

  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  return { props: { users: JSON.parse(JSON.stringify(users)) } };
};

export default AdminUsersPage;

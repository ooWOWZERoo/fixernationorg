import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  invitedById: string;
  createdAt: string;
  expiresAt: string;
}

interface Props {
  admins: AdminUser[];
  pendingInvites: PendingInvite[];
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  SUPER_ADMIN: "Super Admin",
};

const ROLE_BADGE: Record<string, string> = {
  SUPER_ADMIN: "bg-amber/20 text-amber-dark border border-amber/30",
  ADMIN: "bg-navy/10 text-navy border border-navy/20",
};

const AdminTeamPage: NextPageWithLayout<Props> = ({
  admins: initialAdmins,
  pendingInvites: initialInvites,
}) => {
  const [admins] = useState(initialAdmins);
  const [invites, setInvites] = useState(initialInvites);
  const [showForm, setShowForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "SUPER_ADMIN">("ADMIN");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setSendError(null);
    setSendSuccess(null);
    try {
      const res = await fetch("/api/admin/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSendError(data.error ?? "Failed to send invite.");
      } else {
        setInvites((prev) => [data, ...prev]);
        setSendSuccess(`Invite sent to ${inviteEmail}`);
        setInviteEmail("");
        setInviteRole("ADMIN");
        setShowForm(false);
      }
    } catch {
      setSendError("Network error — please try again.");
    } finally {
      setSending(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm("Revoke this invite?")) return;
    setRevoking(id);
    try {
      const res = await fetch(`/api/admin/team/invite/${id}`, { method: "DELETE" });
      if (res.ok) {
        setInvites((prev) => prev.filter((i) => i.id !== id));
      }
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Team</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage who has admin access to this backend.
          </p>
        </div>
        <button
          onClick={() => { setShowForm((v) => !v); setSendError(null); setSendSuccess(null); }}
          className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy-dark"
        >
          {showForm ? "Cancel" : "Invite admin"}
        </button>
      </div>

      {sendSuccess && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {sendSuccess}
        </div>
      )}

      {/* Invite form */}
      {showForm && (
        <div className="mb-8 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-semibold text-slate-700">Send admin invitation</h2>
          <p className="mb-4 text-xs text-slate-400">
            The recipient will receive an email with a unique setup link. They must not already have an account — use the Users page to promote an existing member.
          </p>
          <form onSubmit={handleSendInvite} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">
                Email address
              </label>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">
                Role
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "ADMIN" | "SUPER_ADMIN")}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
              >
                <option value="ADMIN">Admin</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={sending}
              className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy-dark disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send invite"}
            </button>
          </form>
          {sendError && (
            <p className="mt-3 text-xs text-red-500">{sendError}</p>
          )}
        </div>
      )}

      {/* Current admins */}
      <div className="mb-8 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-slate-700">Current team</h2>
        </div>
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Email</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Role</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Member since</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {admins.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm font-medium text-slate-900">{u.name ?? "—"}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${ROLE_BADGE[u.role] ?? "bg-slate-100 text-slate-600"}`}>
                    {ROLE_LABEL[u.role] ?? u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-700">Pending invitations</h2>
          </div>
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Sent</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Expires</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invites.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm text-slate-700">{inv.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${ROLE_BADGE[inv.role] ?? "bg-slate-100 text-slate-600"}`}>
                      {ROLE_LABEL[inv.role] ?? inv.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {new Date(inv.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {new Date(inv.expiresAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleRevoke(inv.id)}
                      disabled={revoking === inv.id}
                      className="text-xs font-semibold text-red-500 hover:text-red-700 disabled:opacity-40"
                    >
                      {revoking === inv.id ? "Revoking…" : "Revoke"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {invites.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center">
          <p className="text-sm text-slate-400">No pending invitations.</p>
        </div>
      )}
    </div>
  );
};

AdminTeamPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return { redirect: { destination: "/admin", permanent: false } };
  }

  const now = new Date();

  const [admins, pendingInvites] = await Promise.all([
    db.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    }),
    db.adminInvite.findMany({
      where: { claimedAt: null, expiresAt: { gt: now } },
      select: { id: true, email: true, role: true, invitedById: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    props: {
      admins: JSON.parse(JSON.stringify(admins)),
      pendingInvites: JSON.parse(JSON.stringify(pendingInvites)),
    },
  };
};

export default AdminTeamPage;

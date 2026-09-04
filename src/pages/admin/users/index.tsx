import { Fragment, useState } from "react";
import Link from "next/link";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

// SP-67 Stage 4 — UserMembership isn't known to the local Prisma client yet.
type UsersMembershipDb = {
  userMembership: {
    findMany: (a: Record<string, unknown>) => Promise<{ userId: string }[]>;
  };
};

const MEMBERSHIP_ROLES = ["CONSUMER", "MEMBER", "PROVIDER", "AMBASSADOR"] as const;
const ADMIN_ROLE_OPTIONS = ["NONE", "ADMIN", "SUPER_ADMIN"] as const;

const MEMBERSHIP_LABEL: Record<string, string> = {
  CONSUMER: "Consumer",
  MEMBER: "Member",
  PROVIDER: "Service Provider",
  AMBASSADOR: "Brand Ambassador",
};

const ADMIN_LABEL: Record<string, string> = {
  NONE: "None",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super Admin",
};

const MEMBERSHIP_BADGE: Record<string, string> = {
  CONSUMER: "bg-slate-100 text-slate-600",
  MEMBER: "bg-navy/10 text-navy",
  PROVIDER: "bg-sky-100 text-sky-700",
  AMBASSADOR: "bg-violet-100 text-violet-700",
};

const ADMIN_BADGE: Record<string, string> = {
  NONE: "bg-slate-100 text-slate-500",
  ADMIN: "bg-amber/15 text-amber-dark border border-amber/30",
  SUPER_ADMIN: "bg-amber/30 text-amber-dark border border-amber/50 font-bold",
};

interface UserRow {
  id: string;
  name: string | null;
  email: string;
  role: string;
  adminRole: string;
  createdAt: string;
  hasMembership: boolean;
  emailVerified: string | null;
}

interface Props {
  users: UserRow[];
  myId: string;
  myAdminRole: string;
}

const AdminUsersPage: NextPageWithLayout<Props> = ({ users: initialUsers, myId, myAdminRole }) => {
  const [users, setUsers] = useState(initialUsers);
  const [saving, setSaving] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ id: string; ok: boolean; msg: string } | null>(null);
  const [passwordPanelFor, setPasswordPanelFor] = useState<string | null>(null);
  const [passwordDraft, setPasswordDraft] = useState("");
  const [settingPassword, setSettingPassword] = useState<string | null>(null);
  const [passwordFeedback, setPasswordFeedback] = useState<{ id: string; ok: boolean; msg: string } | null>(null);
  const [verifyingEmail, setVerifyingEmail] = useState<string | null>(null);

  const iAmSuperAdmin = myAdminRole === "SUPER_ADMIN";

  async function verifyEmail(userId: string) {
    setVerifyingEmail(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/verify-email`, { method: "POST" });
      if (res.ok) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, emailVerified: new Date().toISOString() } : u)));
        setPasswordFeedback({ id: userId, ok: true, msg: "Email verified" });
        setTimeout(() => setPasswordFeedback(null), 2000);
      } else {
        const data = await res.json();
        setPasswordFeedback({ id: userId, ok: false, msg: data.error ?? "Failed" });
      }
    } catch {
      setPasswordFeedback({ id: userId, ok: false, msg: "Network error" });
    } finally {
      setVerifyingEmail(null);
    }
  }

  async function submitPassword(userId: string) {
    if (passwordDraft.length < 8) {
      setPasswordFeedback({ id: userId, ok: false, msg: "At least 8 characters" });
      return;
    }
    setSettingPassword(userId);
    setPasswordFeedback(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordDraft }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordFeedback({ id: userId, ok: false, msg: data.error ?? "Failed" });
      } else {
        setPasswordFeedback({ id: userId, ok: true, msg: "Password set" });
        setPasswordDraft("");
        setTimeout(() => {
          setPasswordFeedback(null);
          setPasswordPanelFor(null);
        }, 2000);
      }
    } catch {
      setPasswordFeedback({ id: userId, ok: false, msg: "Network error" });
    } finally {
      setSettingPassword(null);
    }
  }

  async function updateField(userId: string, field: "role" | "adminRole", value: string) {
    setSaving(userId);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ id: userId, ok: false, msg: data.error ?? "Failed" });
      } else {
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, [field]: value } : u)));
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
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Users</h1>
          <p className="mt-1 text-sm text-slate-500">
            {users.length} registered user{users.length !== 1 ? "s" : ""}.{" "}
            {iAmSuperAdmin && (
              <span className="text-slate-400">Membership and staff access can be edited independently.</span>
            )}
          </p>
        </div>
        {iAmSuperAdmin && (
          <Link
            href="/admin/team"
            className="whitespace-nowrap text-sm font-semibold text-navy hover:underline"
          >
            Invite a new admin →
          </Link>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Membership role
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Staff access
                  {iAmSuperAdmin && <span className="ml-1.5 text-[10px] font-normal normal-case text-amber-dark">(Super Admin only)</span>}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Joined</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => {
                const isMe = user.id === myId;
                const targetIsSuperAdmin = user.adminRole === "SUPER_ADMIN";
                const canEditMembership = !isMe && !(targetIsSuperAdmin && !iAmSuperAdmin);
                const canEditAdmin = iAmSuperAdmin && !isMe;
                const canSetPassword = !isMe && !(targetIsSuperAdmin && !iAmSuperAdmin);
                const fb = feedback?.id === user.id ? feedback : null;
                const pwFb = passwordFeedback?.id === user.id ? passwordFeedback : null;
                const panelOpen = passwordPanelFor === user.id;

                return (
                  <Fragment key={user.id}>
                  <tr className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{user.name ?? "—"}</p>
                          <p className="text-xs text-slate-400">{user.email}</p>
                        </div>
                        {isMe && (
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                            you
                          </span>
                        )}
                        {user.hasMembership && (
                          <Link
                            href="/admin/memberships"
                            title="View membership"
                            className="rounded-full bg-navy/10 px-2 py-0.5 text-[10px] font-semibold text-navy hover:bg-navy/20"
                          >
                            Membership →
                          </Link>
                        )}
                      </div>
                    </td>

                    {/* Membership role */}
                    <td className="px-4 py-3">
                      {canEditMembership ? (
                        <select
                          value={user.role}
                          disabled={saving === user.id}
                          onChange={(e) => updateField(user.id, "role", e.target.value)}
                          className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 focus:border-navy focus:outline-none disabled:opacity-50"
                        >
                          {MEMBERSHIP_ROLES.map((r) => (
                            <option key={r} value={r}>{MEMBERSHIP_LABEL[r]}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${MEMBERSHIP_BADGE[user.role] ?? "bg-slate-100 text-slate-600"}`}>
                          {MEMBERSHIP_LABEL[user.role] ?? user.role}
                        </span>
                      )}
                    </td>

                    {/* Staff access (adminRole) */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {canEditAdmin ? (
                          <select
                            value={user.adminRole}
                            disabled={saving === user.id}
                            onChange={(e) => updateField(user.id, "adminRole", e.target.value)}
                            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 focus:border-navy focus:outline-none disabled:opacity-50"
                          >
                            {ADMIN_ROLE_OPTIONS.map((r) => (
                              <option key={r} value={r}>{ADMIN_LABEL[r]}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${ADMIN_BADGE[user.adminRole] ?? "bg-slate-100 text-slate-500"}`}>
                            {ADMIN_LABEL[user.adminRole] ?? user.adminRole}
                          </span>
                        )}
                        {saving === user.id && <span className="text-xs text-slate-400">Saving…</span>}
                        {fb && (
                          <span className={`text-xs ${fb.ok ? "text-green-600" : "text-red-500"}`}>
                            {fb.msg}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        {canSetPassword && (
                          <button
                            type="button"
                            onClick={() => {
                              setPasswordDraft("");
                              setPasswordFeedback(null);
                              setPasswordPanelFor(panelOpen ? null : user.id);
                            }}
                            className="text-xs font-medium text-navy hover:underline"
                          >
                            {panelOpen ? "Cancel" : "Set password"}
                          </button>
                        )}
                        {!user.emailVerified && (
                          <div className="flex items-center gap-1.5">
                            <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                              Unverified
                            </span>
                            {canSetPassword && (
                              <button
                                type="button"
                                onClick={() => verifyEmail(user.id)}
                                disabled={verifyingEmail === user.id}
                                className="text-xs font-medium text-navy hover:underline disabled:opacity-50"
                              >
                                {verifyingEmail === user.id ? "Verifying…" : "Verify email"}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                  {panelOpen && (
                    <tr className="bg-slate-50">
                      <td colSpan={5} className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">
                            New password for <span className="font-medium text-slate-700">{user.email}</span>:
                          </span>
                          <input
                            type="text"
                            value={passwordDraft}
                            onChange={(e) => setPasswordDraft(e.target.value)}
                            placeholder="At least 8 characters"
                            autoComplete="new-password"
                            disabled={settingPassword === user.id}
                            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-navy focus:outline-none disabled:opacity-50"
                          />
                          <button
                            type="button"
                            onClick={() => submitPassword(user.id)}
                            disabled={settingPassword === user.id}
                            className="rounded-md bg-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-navy/90 disabled:opacity-50"
                          >
                            {settingPassword === user.id ? "Saving…" : "Save password"}
                          </button>
                          {pwFb && (
                            <span className={`text-xs ${pwFb.ok ? "text-green-600" : "text-red-500"}`}>
                              {pwFb.msg}
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 text-xs text-slate-400">
                          Shown here so you can read it and hand it to the account holder directly (e.g. by phone) — it is not emailed anywhere by this action.
                        </p>
                      </td>
                    </tr>
                  )}
                  </Fragment>
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
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return { redirect: { destination: `/signin?callbackUrl=${encodeURIComponent(context.resolvedUrl)}`, permanent: false } };
  }

  const [users, memberships] = await Promise.all([
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, role: true, adminRole: true, createdAt: true, emailVerified: true },
    }),
    (db as never as UsersMembershipDb).userMembership.findMany({ select: { userId: true } }),
  ]);

  const membershipUserIds = new Set(memberships.map((m) => m.userId));
  const usersWithMembership = users.map((u) => ({ ...u, hasMembership: membershipUserIds.has(u.id) }));

  return {
    props: {
      users: JSON.parse(JSON.stringify(usersWithMembership)),
      myId: session.user.id,
      myAdminRole: session.user.adminRole,
    },
  };
};

export default AdminUsersPage;

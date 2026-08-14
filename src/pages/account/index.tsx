import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

interface Props {
  user: {
    name: string | null;
    email: string;
    hasPassword: boolean;
  };
}

const AccountSettingsPage: NextPageWithLayout<Props> = ({ user }) => {
  const [name, setName] = useState(user.name ?? "");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setNameSaving(true);
    setNameMsg(null);
    const res = await fetch("/api/account/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "name", name }),
    });
    const data = await res.json();
    setNameMsg(res.ok ? { ok: true, text: "Name updated." } : { ok: false, text: data.error ?? "Something went wrong." });
    setNameSaving(false);
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== confirmPw) {
      setPwMsg({ ok: false, text: "Passwords don't match." });
      return;
    }
    setPwSaving(true);
    setPwMsg(null);
    const res = await fetch("/api/account/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "password", currentPassword: currentPw, newPassword: newPw }),
    });
    const data = await res.json();
    if (res.ok) {
      setPwMsg({ ok: true, text: "Password updated." });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } else {
      setPwMsg({ ok: false, text: data.error ?? "Something went wrong." });
    }
    setPwSaving(false);
  }

  return (
    <>
      <Head>
        <title>Account Settings — Fixer Nation</title>
      </Head>

      <section className="px-6 py-14 lg:px-8">
        <div className="mx-auto max-w-xl">
          <div className="mb-2 flex items-center gap-3">
            <Link href="/account/profile" className="text-sm font-semibold text-ink-soft no-underline hover:text-navy">
              ← My Profile
            </Link>
            <span className="text-ink-soft/40">·</span>
            <Link href="/account/security" className="text-sm font-semibold text-ink-soft no-underline hover:text-navy">
              Security
            </Link>
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-navy">Account Settings</h1>
          <p className="mt-1 text-sm text-ink-soft">{user.email}</p>

          {/* Display name */}
          <form onSubmit={saveName} className="mt-10 space-y-4 rounded-2xl border border-navy/8 bg-white p-6">
            <h2 className="text-base font-extrabold text-navy">Display name</h2>
            <div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                maxLength={100}
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
              />
            </div>
            {nameMsg && (
              <p className={`text-sm font-semibold ${nameMsg.ok ? "text-green-700" : "text-red-600"}`}>
                {nameMsg.text}
              </p>
            )}
            <button
              type="submit"
              disabled={nameSaving}
              className="rounded-[10px] bg-navy px-5 py-2.5 text-sm font-bold text-white hover:bg-navy-dark disabled:opacity-50 transition-colors"
            >
              {nameSaving ? "Saving…" : "Save name"}
            </button>
          </form>

          {/* Password */}
          {user.hasPassword ? (
            <form onSubmit={savePassword} className="mt-6 space-y-4 rounded-2xl border border-navy/8 bg-white p-6">
              <h2 className="text-base font-extrabold text-navy">Change password</h2>
              <div>
                <label className="mb-1 block text-sm font-bold text-navy">Current password</label>
                <input
                  type="password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold text-navy">New password</label>
                <input
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold text-navy">Confirm new password</label>
                <input
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                />
              </div>
              {pwMsg && (
                <p className={`text-sm font-semibold ${pwMsg.ok ? "text-green-700" : "text-red-600"}`}>
                  {pwMsg.text}
                </p>
              )}
              <button
                type="submit"
                disabled={pwSaving}
                className="rounded-[10px] bg-navy px-5 py-2.5 text-sm font-bold text-white hover:bg-navy-dark disabled:opacity-50 transition-colors"
              >
                {pwSaving ? "Saving…" : "Update password"}
              </button>
            </form>
          ) : (
            <div className="mt-6 rounded-2xl border border-navy/8 bg-white p-6">
              <h2 className="text-base font-extrabold text-navy">Password</h2>
              <p className="mt-2 text-sm text-ink-soft">
                This account uses social sign-in and doesn't have a password.
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  );
};

AccountSettingsPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) {
    return {
      redirect: {
        destination: `/signin?callbackUrl=${encodeURIComponent("/account")}`,
        permanent: false,
      },
    };
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, passwordHash: true },
  });

  return {
    props: {
      user: {
        name: user?.name ?? null,
        email: user?.email ?? session.user.email ?? "",
        hasPassword: !!user?.passwordHash,
      },
    },
  };
};

export default AccountSettingsPage;

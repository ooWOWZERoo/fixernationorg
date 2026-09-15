import Head from "next/head";
import Link from "next/link";
import { AccountNav } from "@/components/account/AccountNav";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { PushNotificationToggle } from "@/components/PushNotificationToggle";
import type { NextPageWithLayout } from "@/types/next";

type ConsentTopic = "MORNING_BOOST" | "CAMPAIGNS" | "NEWSLETTERS" | "PRODUCT_UPDATES";

const EMAIL_PREF_TOPICS: { key: ConsentTopic; label: string; description: string }[] = [
  { key: "MORNING_BOOST", label: "Morning Boost", description: "Get the daily Morning Boost email — a short read to start your day." },
  { key: "CAMPAIGNS", label: "Promos & offers", description: "Deals, discounts, and time-limited offers from Fixer Nation." },
  { key: "NEWSLETTERS", label: "Newsletter", description: "A periodic roundup of what's happening at Fixer Nation." },
  { key: "PRODUCT_UPDATES", label: "Product updates", description: "New features and changes as we roll them out." },
];

// Mirrors TEMPLATE_CATEGORIES in src/pages/admin/automations/index.tsx (minus
// the empty "license" tab) -- these are the categories a user's automated
// emails (challenges, pathways, check-ins, recognitions, Brain Builder,
// loyalty milestones, the book-gift welcome series, etc.) can be tagged with.
const AUTOMATION_CATEGORIES: { key: string; label: string }[] = [
  { key: "lead", label: "Lead generation" },
  { key: "cart", label: "Membership checkout" },
  { key: "books", label: "Digital guides" },
  { key: "curriculum", label: "Challenges & games" },
  { key: "marketing", label: "Marketing" },
  { key: "success", label: "Customer success" },
  { key: "payments", label: "Payments & ops" },
];

interface Props {
  user: {
    name: string | null;
    email: string;
    hasPassword: boolean;
    emailPrefs: Record<ConsentTopic, boolean>;
    role: string;
    automationsOptedOutAll: boolean;
    automationCategoryOptOuts: string[];
  };
}

const AccountSettingsPage: NextPageWithLayout<Props> = ({ user }) => {
  const isProvider = user.role === "PROVIDER";
  const [name, setName] = useState(user.name ?? "");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [emailPrefs, setEmailPrefs] = useState(user.emailPrefs);
  const [prefsSaving, setPrefsSaving] = useState<ConsentTopic | null>(null);
  const [prefsMsg, setPrefsMsg] = useState<{ topic: ConsentTopic; ok: boolean; text: string } | null>(null);

  const [optedOutAll, setOptedOutAll] = useState(user.automationsOptedOutAll);
  const [categoryOptOuts, setCategoryOptOuts] = useState<string[]>(user.automationCategoryOptOuts);
  const [automationSaving, setAutomationSaving] = useState<string | null>(null);
  const [automationMsg, setAutomationMsg] = useState<{ key: string; ok: boolean; text: string } | null>(null);

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

  async function saveEmailPref(topic: ConsentTopic, checked: boolean) {
    setPrefsSaving(topic);
    setPrefsMsg(null);
    setEmailPrefs((prev) => ({ ...prev, [topic]: checked }));
    const res = await fetch("/api/account/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "emailPrefs", topic, optedIn: checked }),
    });
    const data = await res.json();
    setPrefsMsg(res.ok ? { topic, ok: true, text: "Saved." } : { topic, ok: false, text: data.error ?? "Something went wrong." });
    setTimeout(() => setPrefsMsg(null), 2500);
    setPrefsSaving(null);
  }

  async function saveOptOutAll(checked: boolean) {
    setAutomationSaving("all");
    setAutomationMsg(null);
    setOptedOutAll(checked);
    const res = await fetch("/api/account/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "automationOptOutAll", optedOutAll: checked }),
    });
    const data = await res.json();
    setAutomationMsg(res.ok ? { key: "all", ok: true, text: "Saved." } : { key: "all", ok: false, text: data.error ?? "Something went wrong." });
    setTimeout(() => setAutomationMsg(null), 2500);
    setAutomationSaving(null);
  }

  async function saveCategoryOptOut(category: string, on: boolean) {
    // Checkbox shows "on" = category NOT opted out, so toggling off adds it to the opt-out list.
    const optedOut = !on;
    setAutomationSaving(category);
    setAutomationMsg(null);
    setCategoryOptOuts((prev) => (optedOut ? [...prev.filter((c) => c !== category), category] : prev.filter((c) => c !== category)));
    const res = await fetch("/api/account/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "automationCategoryOptOut", category, optedOut }),
    });
    const data = await res.json();
    setAutomationMsg(res.ok ? { key: category, ok: true, text: "Saved." } : { key: category, ok: false, text: data.error ?? "Something went wrong." });
    setTimeout(() => setAutomationMsg(null), 2500);
    setAutomationSaving(null);
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
        <div className="mx-auto max-w-3xl">
          <AccountNav />
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

          {/* Email preferences */}
          <div className="mt-6 rounded-2xl border border-navy/8 bg-white p-6">
            <h2 className="text-base font-extrabold text-navy">Email preferences</h2>
            <div className="mt-4 space-y-4">
              {EMAIL_PREF_TOPICS.map((topic) => (
                <div key={topic.key}>
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={emailPrefs[topic.key]}
                      disabled={prefsSaving === topic.key}
                      onChange={(e) => saveEmailPref(topic.key, e.target.checked)}
                      className="mt-0.5 h-4 w-4 cursor-pointer accent-navy"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-ink">{topic.label}</span>
                      <span className="block text-sm text-ink-soft">{topic.description}</span>
                    </span>
                  </label>
                  {prefsMsg?.topic === topic.key && (
                    <p className={`mt-1.5 text-sm font-semibold ${prefsMsg.ok ? "text-green-700" : "text-red-600"}`}>
                      {prefsMsg.text}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <PushNotificationToggle />
          </div>

          {/* Automated emails */}
          <div className="mt-6 rounded-2xl border border-navy/8 bg-white p-6">
            <h2 className="text-base font-extrabold text-navy">Automated emails</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Celebratory and progress emails triggered by things you do in Fixer Nation — challenges, pathways, check-ins, recognitions, Brain Builder, and more.
            </p>
            <div className="mt-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={optedOutAll}
                  disabled={automationSaving === "all"}
                  onChange={(e) => saveOptOutAll(e.target.checked)}
                  className="mt-0.5 h-4 w-4 cursor-pointer accent-navy"
                />
                <span>
                  <span className="block text-sm font-semibold text-ink">Turn off all automated emails</span>
                  <span className="block text-sm text-ink-soft">Stop every automated email below, regardless of category.</span>
                </span>
              </label>
              {automationMsg?.key === "all" && (
                <p className={`mt-1.5 text-sm font-semibold ${automationMsg.ok ? "text-green-700" : "text-red-600"}`}>
                  {automationMsg.text}
                </p>
              )}
            </div>
            <div className={`mt-4 space-y-4 border-t border-navy/8 pt-4 ${optedOutAll ? "opacity-40" : ""}`}>
              {AUTOMATION_CATEGORIES.map((cat) => {
                const isOn = !categoryOptOuts.includes(cat.key);
                return (
                  <div key={cat.key}>
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isOn}
                        disabled={optedOutAll || automationSaving === cat.key}
                        onChange={(e) => saveCategoryOptOut(cat.key, e.target.checked)}
                        className="mt-0.5 h-4 w-4 cursor-pointer accent-navy disabled:cursor-not-allowed"
                      />
                      <span className="block text-sm font-semibold text-ink">{cat.label}</span>
                    </label>
                    {automationMsg?.key === cat.key && (
                      <p className={`mt-1.5 text-sm font-semibold ${automationMsg.ok ? "text-green-700" : "text-red-600"}`}>
                        {automationMsg.text}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

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

  // automationsOptedOutAll / automationCategoryOptOuts are new User scalar
  // fields not yet in the locally-generated Prisma client types (regenerates
  // on Vercel build) -- fetch without `select` and cast rather than naming
  // them in a typed select.
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      crmContact: {
        select: {
          consents: {
            where: { topic: { in: ["MORNING_BOOST", "CAMPAIGNS", "NEWSLETTERS", "PRODUCT_UPDATES"] } },
            select: { topic: true, optedIn: true },
          },
        },
      },
    },
  });

  const automationFields = user as unknown as {
    automationsOptedOutAll?: boolean;
    automationCategoryOptOuts?: string[];
  } | null;

  const consentByTopic = new Map(user?.crmContact?.consents.map((c) => [c.topic, c.optedIn]) ?? []);

  // Morning Boost predates consent tracking, so a missing row defaults to
  // opted-in (falls back to the legacy boolean) to avoid silently
  // unsubscribing existing recipients. The other topics never had an
  // implicit opt-in, so a missing row means "never asked" -> defaults off.
  const emailPrefs = {
    MORNING_BOOST: consentByTopic.get("MORNING_BOOST") ?? (user?.morningBoostEmails ?? true),
    CAMPAIGNS: consentByTopic.get("CAMPAIGNS") ?? false,
    NEWSLETTERS: consentByTopic.get("NEWSLETTERS") ?? false,
    PRODUCT_UPDATES: consentByTopic.get("PRODUCT_UPDATES") ?? false,
  };

  return {
    props: {
      user: {
        name: user?.name ?? null,
        email: user?.email ?? session.user.email ?? "",
        hasPassword: !!user?.passwordHash,
        emailPrefs,
        role: session.user.role ?? "CONSUMER",
        automationsOptedOutAll: automationFields?.automationsOptedOutAll ?? false,
        automationCategoryOptOuts: automationFields?.automationCategoryOptOuts ?? [],
      },
    },
  };
};

export default AccountSettingsPage;

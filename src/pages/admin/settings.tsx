import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

interface SettingRow {
  key: string;
  value: string;
  updatedAt: string;
}

interface Props {
  settings: SettingRow[];
}

type BackfillResult = {
  usersProcessed: number;
  contactsCreated: number;
  contactsLinked: number;
  consentRowsCreated: number;
  skipped: number;
};

const AdminSettingsPage: NextPageWithLayout<Props> = ({
  settings: initialSettings,
}) => {
  const [settings, setSettings] = useState(initialSettings);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    key: string;
    ok: boolean;
    msg: string;
  } | null>(null);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<BackfillResult | null>(null);
  const [backfillError, setBackfillError] = useState<string | null>(null);

  async function runBackfill() {
    if (!confirm("Run Morning Boost consent backfill? This creates Contact + MORNING_BOOST consent rows for all verified users that don't have one yet. Safe to run multiple times.")) return;
    setBackfilling(true);
    setBackfillResult(null);
    setBackfillError(null);
    try {
      const res = await fetch("/api/admin/backfill/morning-boost-consent", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setBackfillError(data.error ?? "Backfill failed.");
      } else {
        setBackfillResult(data as BackfillResult);
      }
    } catch {
      setBackfillError("Network error.");
    } finally {
      setBackfilling(false);
    }
  }

  function flash(key: string, ok: boolean, msg: string) {
    setFeedback({ key, ok, msg });
    setTimeout(() => setFeedback(null), 2500);
  }

  async function saveSetting(key: string) {
    const value = editing[key] ?? settings.find((s) => s.key === key)?.value ?? "";
    setSaving(key);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      const data = await res.json();
      if (!res.ok) {
        flash(key, false, data.error ?? "Failed");
      } else {
        setSettings((prev) =>
          prev.map((s) =>
            s.key === key ? { ...s, value, updatedAt: data.updatedAt } : s
          )
        );
        setEditing((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        flash(key, true, "Saved");
      }
    } catch {
      flash(key, false, "Network error");
    } finally {
      setSaving(null);
    }
  }

  async function deleteSetting(key: string) {
    if (!confirm(`Delete setting "${key}"?`)) return;
    setDeleting(key);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (res.ok) {
        setSettings((prev) => prev.filter((s) => s.key !== key));
      } else {
        const data = await res.json();
        flash(key, false, data.error ?? "Delete failed");
      }
    } catch {
      flash(key, false, "Network error");
    } finally {
      setDeleting(null);
    }
  }

  async function addSetting(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    const key = newKey.trim();
    if (!key) return setAddError("Key is required.");
    if (settings.some((s) => s.key === key))
      return setAddError("A setting with that key already exists.");
    setAddSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: newValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error ?? "Failed to add setting.");
      } else {
        setSettings((prev) =>
          [...prev, { key: data.key, value: data.value, updatedAt: data.updatedAt }].sort(
            (a, b) => a.key.localeCompare(b.key)
          )
        );
        setNewKey("");
        setNewValue("");
      }
    } catch {
      setAddError("Network error.");
    } finally {
      setAddSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Site Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Runtime configuration flags stored in the database — change behavior without a code deploy. Examples: <code className="rounded bg-slate-100 px-1 text-xs">maintenance.mode</code>, <code className="rounded bg-slate-100 px-1 text-xs">banner.message</code>.
        </p>
      </div>

      {/* Add new */}
      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Add Setting</h2>
        <form onSubmit={addSetting} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">
              Key
            </label>
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="site.maintenance"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy w-48"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">
              Value
            </label>
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="false"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy w-48"
            />
          </div>
          <button
            type="submit"
            disabled={addSaving}
            className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy-dark disabled:opacity-50"
          >
            {addSaving ? "Adding…" : "Add"}
          </button>
          {addError && (
            <p className="w-full text-xs text-red-500">{addError}</p>
          )}
        </form>
      </div>

      {/* Maintenance tasks */}
      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-semibold text-slate-700">Maintenance</h2>
        <p className="mb-4 text-xs text-slate-400">One-off data migrations. All operations are safe to run more than once.</p>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-sm font-medium text-slate-700">Morning Boost consent backfill</p>
            <p className="text-xs text-slate-400">Creates a Contact + MORNING_BOOST consent row for every verified user that doesn&apos;t have one yet.</p>
          </div>
          <button
            onClick={runBackfill}
            disabled={backfilling}
            className="shrink-0 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
          >
            {backfilling ? "Running…" : "Run backfill"}
          </button>
        </div>
        {backfillError && (
          <p className="mt-3 text-xs text-red-500">{backfillError}</p>
        )}
        {backfillResult && (
          <div className="mt-3 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-xs text-green-800 space-y-0.5">
            <p>Users processed: {backfillResult.usersProcessed}</p>
            <p>Contacts created: {backfillResult.contactsCreated}</p>
            <p>Contacts linked: {backfillResult.contactsLinked}</p>
            <p>Consent rows created: {backfillResult.consentRowsCreated}</p>
            <p>Skipped: {backfillResult.skipped}</p>
          </div>
        )}
      </div>

      {/* Settings table */}
      {settings.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-sm text-slate-400">No settings yet. Add one above.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Key
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Value
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Updated
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {settings.map((s) => {
                const isDirty =
                  s.key in editing
                    ? editing[s.key] !== s.value
                    : false;
                const currentValue =
                  s.key in editing ? editing[s.key] : s.value;
                const fb =
                  feedback?.key === s.key ? feedback : null;

                return (
                  <tr key={s.key} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <code className="text-xs font-mono text-slate-700">
                        {s.key}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={currentValue}
                        onChange={(e) =>
                          setEditing((prev) => ({
                            ...prev,
                            [s.key]: e.target.value,
                          }))
                        }
                        className="w-full min-w-[200px] rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {new Date(s.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {fb && (
                          <span
                            className={`text-xs ${fb.ok ? "text-green-600" : "text-red-500"}`}
                          >
                            {fb.msg}
                          </span>
                        )}
                        <button
                          onClick={() => saveSetting(s.key)}
                          disabled={saving === s.key || !isDirty}
                          className="rounded-md bg-navy px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-navy-dark disabled:opacity-40"
                        >
                          {saving === s.key ? "Saving…" : "Save"}
                        </button>
                        <button
                          onClick={() => deleteSetting(s.key)}
                          disabled={deleting === s.key}
                          className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-500 transition-colors hover:bg-red-50 disabled:opacity-40"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

AdminSettingsPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return { redirect: { destination: `/signin?callbackUrl=${encodeURIComponent(context.resolvedUrl)}`, permanent: false } };
  }

  const settings = await db.setting.findMany({ orderBy: { key: "asc" } });

  return { props: { settings: JSON.parse(JSON.stringify(settings)) } };
};

export default AdminSettingsPage;

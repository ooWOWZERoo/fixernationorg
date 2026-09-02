import Head from "next/head";
import { useRouter } from "next/router";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

interface AudienceRuleSummary { type: string; label: string }
interface MetricData {
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalBounced: number;
  totalUnsubscribed: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  unsubRate: number;
  computedAt: string;
}
interface VariantRow {
  id: string;
  name: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  htmlBody: string;
  textBody: string | null;
  splitPct: number;
  createdAt: string;
}
interface VariantStat {
  variantId: string | null; // null = control (variant A)
  name: string;
  subject: string;
  sent: number;
  opened: number;
  clicked: number;
  openRate: number;
  clickRate: number;
}
interface Props {
  campaign: {
    id: string;
    name: string;
    status: string;
    channelType: string;
    subject: string;
    fromName: string;
    fromEmail: string;
    htmlBody: string | null;
    textBody: string | null;
    pushUrl: string | null;
    pushIcon: string | null;
    listId: string | null;
    listName: string | null;
    hasAudienceRules: boolean;
    audienceRuleSummary: AudienceRuleSummary[];
    sendCount: number;
    scheduledAt: string | null;
    sentAt: string | null;
    createdAt: string;
    isAbTest: boolean;
    isAmbassadorMaterial: boolean;
    isRecurring: boolean;
    parentCampaignId: string | null;
    recurrenceTime: string | null;
    recurrenceSource: string | null;
    recurrenceActive: boolean;
  };
  metric: MetricData | null;
  variants: VariantRow[];
  variantStats: VariantStat[];
  attributedCount: number;
  conversionCount: number;
  conversionRevenue: number;
  occurrences: Array<{ id: string; name: string; subject: string; status: string; sentAt: string | null; sendCount: number }>;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-navy/8 text-navy",
  SCHEDULED: "bg-amber/20 text-amber-dark",
  SENDING: "bg-blue-100 text-blue-700",
  SENT: "bg-green-100 text-green-800",
  PAUSED: "bg-yellow-100 text-yellow-800",
  CANCELLED: "bg-red-100 text-red-700",
};

const AdminCampaignDetailPage: NextPageWithLayout<Props> = ({ campaign: initial, metric: initialMetric, variants: initialVariants, variantStats: initialVariantStats, attributedCount, conversionCount, conversionRevenue, occurrences }) => {
  const router = useRouter();
  const [campaign, setCampaign] = useState(initial);
  const [metric, setMetric] = useState(initialMetric);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [materialToggling, setMaterialToggling] = useState(false);

  // ── Recurring template view state ──
  const [recurrenceActive, setRecurrenceActive] = useState(initial.recurrenceActive ?? true);
  const [recurrenceTimeInput, setRecurrenceTimeInput] = useState(initial.recurrenceTime ?? "07:00");
  const [savingRecurrence, setSavingRecurrence] = useState(false);
  const [pauseToggling, setPauseToggling] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<{ willSend: boolean; reason?: string; subject?: string; html?: string } | null>(null);

  async function togglePause() {
    setPauseToggling(true);
    const next = !recurrenceActive;
    const res = await fetch(`/api/admin/campaigns/${campaign.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recurrenceActive: next }),
    });
    if (res.ok) setRecurrenceActive(next);
    setPauseToggling(false);
  }

  async function saveRecurrenceTime() {
    setSavingRecurrence(true);
    await fetch(`/api/admin/campaigns/${campaign.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recurrenceTime: recurrenceTimeInput }),
    });
    setSavingRecurrence(false);
  }

  async function previewNextSend() {
    setPreviewLoading(true);
    setPreviewResult(null);
    try {
      const res = await fetch(`/api/admin/campaigns/${campaign.id}/preview-occurrence`);
      const data = await res.json();
      setPreviewResult(data);
    } catch {
      setPreviewResult({ willSend: false, reason: "Preview failed to load" });
    } finally {
      setPreviewLoading(false);
    }
  }

  async function toggleAmbassadorMaterial() {
    setMaterialToggling(true);
    const next = !campaign.isAmbassadorMaterial;
    await fetch(`/api/admin/campaigns/${campaign.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAmbassadorMaterial: next }),
    });
    setCampaign((c) => ({ ...c, isAmbassadorMaterial: next }));
    setMaterialToggling(false);
  }

  // A/B variants
  const [variants, setVariants] = useState<VariantRow[]>(initialVariants);
  const [variantStats] = useState<VariantStat[]>(initialVariantStats);
  const [addingVariant, setAddingVariant] = useState(false);
  const [variantSaving, setVariantSaving] = useState(false);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [variantForm, setVariantForm] = useState({
    subject: initial.subject, fromName: initial.fromName, fromEmail: initial.fromEmail,
    htmlBody: initial.htmlBody, textBody: initial.textBody ?? "", splitPct: 50,
  });
  const [editVariantForm, setEditVariantForm] = useState<Partial<VariantRow>>({});

  async function refreshMetrics() {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/admin/campaigns/${campaign.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "compute_metrics" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setMetric({
        totalSent: data.totalSent,
        totalDelivered: data.totalDelivered,
        totalOpened: data.totalOpened,
        totalClicked: data.totalClicked,
        totalBounced: data.totalBounced,
        totalUnsubscribed: data.totalUnsubscribed,
        openRate: data.openRate,
        clickRate: data.clickRate,
        bounceRate: data.bounceRate,
        unsubRate: data.unsubRate,
        computedAt: data.computedAt,
      });
    } catch { /* silent */ } finally { setRefreshing(false); }
  }

  async function triggerSend() {
    if (!confirm(`Send "${campaign.name}" to all contacts on the list now?`)) return;
    setSending(true);
    setError(null);
    setSendResult(null);
    try {
      const res = await fetch(`/api/admin/campaigns/${campaign.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setSendResult(data.message);
      setCampaign((c) => ({ ...c, status: "SENT", sentAt: new Date().toISOString() }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally { setSending(false); }
  }

  async function deleteCampaign() {
    if (!confirm("Delete this campaign?")) return;
    await fetch(`/api/admin/campaigns/${campaign.id}`, { method: "DELETE" });
    router.push("/admin/campaigns");
  }

  async function addVariant() {
    setVariantSaving(true);
    try {
      const usedNames = new Set(variants.map((v) => v.name));
      const nextName = ["B", "C", "D"].find((n) => !usedNames.has(n)) ?? "B";
      const r = await fetch(`/api/admin/campaigns/${campaign.id}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...variantForm, name: nextName, textBody: variantForm.textBody || undefined }),
      });
      if (!r.ok) { const d = await r.json(); setError(d.error ?? "Failed"); return; }
      const saved: VariantRow = await r.json();
      setVariants((prev) => [...prev, saved]);
      setCampaign((c) => ({ ...c, isAbTest: true }));
      setAddingVariant(false);
    } finally { setVariantSaving(false); }
  }

  async function saveVariantEdit(vid: string) {
    setVariantSaving(true);
    try {
      const r = await fetch(`/api/admin/campaigns/${campaign.id}/variants/${vid}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editVariantForm),
      });
      if (!r.ok) return;
      const saved: VariantRow = await r.json();
      setVariants((prev) => prev.map((v) => v.id === vid ? saved : v));
      setEditingVariantId(null);
    } finally { setVariantSaving(false); }
  }

  async function deleteVariant(vid: string) {
    if (!confirm("Remove this variant?")) return;
    await fetch(`/api/admin/campaigns/${campaign.id}/variants/${vid}`, { method: "DELETE" });
    const remaining = variants.filter((v) => v.id !== vid);
    setVariants(remaining);
    if (remaining.length === 0) setCampaign((c) => ({ ...c, isAbTest: false }));
  }

  const controlSplitPct = Math.max(0, 100 - variants.reduce((s, v) => s + v.splitPct, 0));

  const pct = (n: number) => `${Math.round(n * 100)}%`;

  // Recurring templates never themselves get sent/tracked (occurrences
  // handle that, and render via the normal path below unchanged since
  // they're just regular Campaign rows with parentCampaignId set) — show a
  // dedicated config + history view instead of the full send/stats page.
  if (campaign.isRecurring && !campaign.parentCampaignId) {
    return (
      <>
        <Head><title>{campaign.name} — Campaigns Admin</title></Head>
        <div className="mb-4 flex items-center gap-2 text-sm text-ink-soft">
          <a href="/admin/campaigns" className="text-navy hover:underline">Campaigns</a>
          <span>/</span>
          <span>{campaign.name}</span>
        </div>

        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-navy">{campaign.name}</h1>
            <p className="mt-1 text-sm text-ink-soft">Recurring campaign — fires daily and creates a fresh occurrence each time.</p>
          </div>
          <button onClick={deleteCampaign} className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50">
            Delete template
          </button>
        </div>

        <div className="mb-6 rounded-2xl border border-navy/8 bg-white p-6">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-ink-soft">Recurrence</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Frequency</label>
              <div className="rounded-xl border border-navy/15 bg-cream-panel px-4 py-2 text-sm text-ink-soft">Daily</div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Time (UTC)</label>
              <div className="flex gap-2">
                <input type="time" value={recurrenceTimeInput} onChange={(e) => setRecurrenceTimeInput(e.target.value)}
                  className="rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
                <button onClick={saveRecurrenceTime} disabled={savingRecurrence || recurrenceTimeInput === (campaign.recurrenceTime ?? "")}
                  className="rounded-xl border border-navy/15 px-4 py-2 text-sm font-semibold text-navy hover:bg-cream-panel disabled:opacity-40">
                  {savingRecurrence ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Content source</label>
              <div className="rounded-xl border border-navy/15 bg-cream-panel px-4 py-2 text-sm text-ink-soft">
                {campaign.recurrenceSource === "MORNING_BOOST" ? "Today's Morning Boost" : "Static content"}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Status</label>
              <button onClick={togglePause} disabled={pauseToggling}
                className={[
                  "rounded-full px-4 py-2 text-sm font-bold transition-colors disabled:opacity-40",
                  recurrenceActive ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-slate-100 text-slate-500 hover:bg-slate-200",
                ].join(" ")}>
                {pauseToggling ? "…" : recurrenceActive ? "Active — click to pause" : "Paused — click to resume"}
              </button>
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-navy/8 bg-white p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-ink-soft">Preview next send</h2>
            <button onClick={previewNextSend} disabled={previewLoading}
              className="rounded-xl border border-navy/15 px-4 py-2 text-sm font-semibold text-navy hover:bg-cream-panel disabled:opacity-40">
              {previewLoading ? "Loading…" : "Preview next send"}
            </button>
          </div>
          {previewResult && (
            previewResult.willSend ? (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                <p className="text-sm font-semibold text-green-800">Subject: {previewResult.subject}</p>
                {previewResult.html && (
                  <iframe title="Preview" srcDoc={previewResult.html} className="mt-3 h-96 w-full rounded-lg border border-navy/10 bg-white" />
                )}
              </div>
            ) : (
              <p className="text-sm text-ink-soft">Won't send yet — {previewResult.reason}</p>
            )
          )}
        </div>

        <div className="rounded-2xl border border-navy/8 bg-white">
          <div className="border-b border-navy/8 px-6 py-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-ink-soft">Occurrence history ({occurrences.length})</h2>
          </div>
          {occurrences.length === 0 ? (
            <p className="p-6 text-sm text-ink-soft">No occurrences yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy/8 text-left text-xs font-bold uppercase tracking-widest text-ink-soft">
                    <th className="px-5 py-3">Occurrence</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Sends</th>
                    <th className="px-5 py-3">Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {occurrences.map((o) => (
                    <tr key={o.id} className="border-b border-navy/5 hover:bg-cream-panel/40">
                      <td className="px-5 py-3">
                        <a href={`/admin/campaigns/${o.id}`} className="font-semibold text-navy hover:underline">{o.name}</a>
                        <div className="text-xs text-ink-soft">{o.subject}</div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[o.status] ?? "bg-navy/8 text-navy"}`}>
                          {o.status.toLowerCase()}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-ink-soft">{o.sendCount}</td>
                      <td className="px-5 py-3 text-ink-soft">{o.sentAt ? new Date(o.sentAt).toLocaleString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <Head><title>{campaign.name} — Campaigns Admin</title></Head>
      <div className="mb-4 flex items-center gap-2 text-sm text-ink-soft">
        <a href="/admin/campaigns" className="hover:underline">Campaigns</a>
        <span>/</span>
        <span>{campaign.name}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main */}
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-2xl border border-navy/8 bg-white p-6">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h1 className="text-xl font-extrabold text-navy">{campaign.name}</h1>
                <p className="mt-0.5 text-sm text-ink-soft">{campaign.subject}</p>
              </div>
              <div className="flex items-center gap-2">
                {campaign.channelType === "PUSH" && (
                  <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">Push</span>
                )}
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[campaign.status] ?? "bg-navy/8 text-navy"}`}>
                  {campaign.status.toLowerCase()}
                </span>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
              {campaign.channelType !== "PUSH" && (
                <div>
                  <span className="block text-xs font-bold uppercase tracking-widest text-ink-soft">From</span>
                  <span>{campaign.fromName} &lt;{campaign.fromEmail}&gt;</span>
                </div>
              )}
              {campaign.channelType === "PUSH" && campaign.pushUrl && (
                <div>
                  <span className="block text-xs font-bold uppercase tracking-widest text-ink-soft">Click URL</span>
                  <span className="truncate">{campaign.pushUrl}</span>
                </div>
              )}
              <div>
                <span className="block text-xs font-bold uppercase tracking-widest text-ink-soft">Audience</span>
                {campaign.hasAudienceRules ? (
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {campaign.audienceRuleSummary.map((r, i) => (
                      <span key={i} className="rounded bg-navy/8 px-1.5 py-0.5 text-xs font-semibold text-navy">
                        {r.type}: {r.label}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span>{campaign.listName ?? "—"}</span>
                )}
              </div>
              {campaign.scheduledAt && (
                <div>
                  <span className="block text-xs font-bold uppercase tracking-widest text-ink-soft">Scheduled</span>
                  <span>{new Date(campaign.scheduledAt).toLocaleString()}</span>
                </div>
              )}
              {campaign.sentAt && (
                <div>
                  <span className="block text-xs font-bold uppercase tracking-widest text-ink-soft">Sent</span>
                  <span>{new Date(campaign.sentAt).toLocaleString()}</span>
                </div>
              )}
            </div>

            {error && <div className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            {sendResult && <div className="mb-3 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">{sendResult}</div>}

            <div className="flex gap-3">
              {(campaign.status === "DRAFT" || campaign.status === "SCHEDULED") && (
                <button onClick={triggerSend} disabled={sending || (!campaign.listId && !campaign.hasAudienceRules)}
                  className="rounded-xl bg-navy px-5 py-2.5 text-sm font-bold text-white hover:bg-navy-dark disabled:opacity-60">
                  {sending ? "Sending…" : "Send now"}
                </button>
              )}
              {campaign.status === "DRAFT" && (
                <a href={`/admin/campaigns/${campaign.id}/edit`}
                  className="rounded-xl border border-navy/15 px-5 py-2.5 text-sm font-bold text-ink-soft hover:bg-cream-panel no-underline">
                  Edit
                </a>
              )}
              {campaign.status !== "SENDING" && (
                <button onClick={deleteCampaign}
                  className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50">
                  Delete
                </button>
              )}
            </div>
            {!campaign.listId && !campaign.hasAudienceRules && campaign.status === "DRAFT" && (
              <p className="mt-2 text-xs text-amber-dark">No audience defined — edit the campaign to set one before sending.</p>
            )}
          </div>

          {/* HTML preview (email only) */}
          {campaign.channelType !== "PUSH" && (
          <div className="rounded-2xl border border-navy/8 bg-white p-5">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-ink-soft">Email preview</h2>
            <div className="overflow-auto rounded-xl border border-navy/8 bg-cream-panel p-4 text-xs font-mono max-h-64 text-ink-soft whitespace-pre-wrap">
              {(campaign.htmlBody ?? "").slice(0, 2000)}{(campaign.htmlBody ?? "").length > 2000 ? "\n…" : ""}
            </div>
          </div>
          )}

          {/* Push notification preview */}
          {campaign.channelType === "PUSH" && (
            <div className="rounded-2xl border border-navy/8 bg-white p-5">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-ink-soft">Notification preview</h2>
              <div className="flex items-start gap-3 rounded-xl border border-navy/8 bg-cream-panel p-4">
                {campaign.pushIcon ? (
                  <img src={campaign.pushIcon} alt="" className="h-10 w-10 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-navy/10 flex items-center justify-center flex-shrink-0">
                    <svg className="h-5 w-5 text-navy/40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-navy">{campaign.subject}</p>
                  {campaign.textBody && <p className="mt-0.5 text-xs text-ink-soft">{campaign.textBody}</p>}
                  {campaign.pushUrl && <p className="mt-1 text-xs text-ink-soft/60">{campaign.pushUrl}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Ambassador materials */}
          {campaign.status === "SENT" && (
            <div className="rounded-2xl border border-navy/8 bg-white p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-ink-soft">Ambassador materials</h2>
                  <p className="mt-1 text-sm text-ink-soft">
                    Share this campaign's content with ambassadors so they can use it in their own outreach.
                  </p>
                </div>
                <label className="flex cursor-pointer items-center gap-2 shrink-0">
                  <input
                    type="checkbox"
                    checked={campaign.isAmbassadorMaterial}
                    onChange={toggleAmbassadorMaterial}
                    disabled={materialToggling}
                    className="h-4 w-4 rounded border-slate-300 accent-navy"
                  />
                  <span className="text-sm font-semibold text-navy">
                    {campaign.isAmbassadorMaterial ? "Available to ambassadors" : "Not shared"}
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* A/B Testing (email only) */}
          {campaign.channelType !== "PUSH" && (campaign.status === "DRAFT" || campaign.status === "SCHEDULED" || campaign.isAbTest) && (
            <div className="rounded-2xl border border-navy/8 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-extrabold text-navy">A/B testing</h2>
                  {campaign.isAbTest && (
                    <p className="mt-0.5 text-xs text-ink-soft">
                      Control (A): {controlSplitPct}% · {variants.length} variant{variants.length !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
                {(campaign.status === "DRAFT" || campaign.status === "SCHEDULED") && variants.length < 3 && !addingVariant && (
                  <button
                    onClick={() => {
                      setVariantForm({ subject: campaign.subject, fromName: campaign.fromName, fromEmail: campaign.fromEmail, htmlBody: campaign.htmlBody, textBody: campaign.textBody ?? "", splitPct: 50 });
                      setAddingVariant(true);
                    }}
                    className="rounded-xl bg-navy/8 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-navy/15">
                    + Add variant
                  </button>
                )}
              </div>

              {!campaign.isAbTest && !addingVariant && (
                <p className="text-sm text-ink-soft">
                  Add a variant to split your audience and test different subject lines or content.
                  Control (A) always uses this campaign&#39;s current content.
                </p>
              )}

              {/* Existing variants */}
              {variants.length > 0 && (
                <div className="space-y-3 mb-4">
                  {/* Control row */}
                  <div className="rounded-xl border border-navy/8 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 flex items-center justify-center rounded-full bg-navy text-white text-xs font-extrabold shrink-0">A</span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-navy truncate">{campaign.subject}</p>
                          <p className="text-xs text-ink-soft">{campaign.fromName} · Control</p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-ink-soft">{controlSplitPct}%</span>
                    </div>
                  </div>

                  {variants.map((v) => (
                    <div key={v.id} className="rounded-xl border border-navy/8 px-4 py-3">
                      {editingVariantId === v.id ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="mb-0.5 block text-xs font-semibold text-ink-soft">Subject</label>
                              <input type="text" value={editVariantForm.subject ?? v.subject}
                                onChange={(e) => setEditVariantForm((f) => ({ ...f, subject: e.target.value }))}
                                className="w-full rounded-lg border border-navy/15 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
                            </div>
                            <div>
                              <label className="mb-0.5 block text-xs font-semibold text-ink-soft">Split %</label>
                              <input type="number" min={1} max={99} value={editVariantForm.splitPct ?? v.splitPct}
                                onChange={(e) => setEditVariantForm((f) => ({ ...f, splitPct: parseInt(e.target.value) || 1 }))}
                                className="w-full rounded-lg border border-navy/15 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
                            </div>
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button onClick={() => saveVariantEdit(v.id)} disabled={variantSaving}
                              className="rounded-lg bg-navy px-3 py-1 text-xs font-bold text-white hover:bg-navy-dark disabled:opacity-60">
                              {variantSaving ? "…" : "Save"}
                            </button>
                            <button onClick={() => setEditingVariantId(null)}
                              className="rounded-lg border border-navy/15 px-3 py-1 text-xs text-ink-soft hover:bg-cream-panel">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 flex items-center justify-center rounded-full bg-amber/30 text-navy-dark text-xs font-extrabold shrink-0">{v.name}</span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-navy truncate">{v.subject}</p>
                              <p className="text-xs text-ink-soft">{v.fromName}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-xs font-semibold text-ink-soft">{v.splitPct}%</span>
                            {(campaign.status === "DRAFT" || campaign.status === "SCHEDULED") && (
                              <div className="flex gap-2 text-xs">
                                <button onClick={() => { setEditingVariantId(v.id); setEditVariantForm({ subject: v.subject, splitPct: v.splitPct }); }}
                                  className="text-ink-soft hover:text-navy">Edit</button>
                                <button onClick={() => deleteVariant(v.id)} className="text-ink-soft hover:text-red-600">Remove</button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add variant form */}
              {addingVariant && (
                <div className="rounded-xl border border-navy/15 bg-cream-panel/40 p-4 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-ink-soft">
                    Variant {["B", "C", "D"].find((n) => !variants.map((v) => v.name).includes(n)) ?? "B"}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="mb-1 block text-xs font-semibold text-ink-soft">Subject line</label>
                      <input type="text" value={variantForm.subject}
                        onChange={(e) => setVariantForm((f) => ({ ...f, subject: e.target.value }))}
                        className="w-full rounded-lg border border-navy/15 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-ink-soft">From name</label>
                      <input type="text" value={variantForm.fromName}
                        onChange={(e) => setVariantForm((f) => ({ ...f, fromName: e.target.value }))}
                        className="w-full rounded-lg border border-navy/15 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-ink-soft">Split %</label>
                      <input type="number" min={1} max={99} value={variantForm.splitPct}
                        onChange={(e) => setVariantForm((f) => ({ ...f, splitPct: parseInt(e.target.value) || 1 }))}
                        className="w-full rounded-lg border border-navy/15 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={addVariant} disabled={variantSaving || !variantForm.subject.trim()}
                      className="rounded-xl bg-navy px-4 py-1.5 text-xs font-bold text-white hover:bg-navy-dark disabled:opacity-60">
                      {variantSaving ? "Saving…" : "Save variant"}
                    </button>
                    <button onClick={() => setAddingVariant(false)}
                      className="rounded-xl border border-navy/15 px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-cream-panel">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* A/B results comparison — shown after send */}
          {campaign.isAbTest && campaign.status === "SENT" && variantStats.length > 1 && (
            <div className="rounded-2xl border border-navy/8 bg-white p-6">
              <h2 className="mb-4 text-sm font-extrabold text-navy">A/B test results</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-navy/8 text-left text-xs font-bold uppercase tracking-widest text-ink-soft">
                      <th className="pb-2 pr-4">Variant</th>
                      <th className="pb-2 pr-4">Subject</th>
                      <th className="pb-2 pr-4 text-right">Sent</th>
                      <th className="pb-2 pr-4 text-right">Opens</th>
                      <th className="pb-2 pr-4 text-right">Open rate</th>
                      <th className="pb-2 text-right">Click rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy/5">
                    {variantStats.map((vs) => {
                      const bestOpenRate = Math.max(...variantStats.map((s) => s.openRate));
                      const isWinner = vs.openRate === bestOpenRate && variantStats.filter((s) => s.openRate === bestOpenRate).length === 1;
                      return (
                        <tr key={vs.variantId ?? "control"} className={isWinner ? "bg-green-50/50" : ""}>
                          <td className="py-2.5 pr-4">
                            <div className="flex items-center gap-2">
                              <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-extrabold ${vs.variantId === null ? "bg-navy text-white" : "bg-amber/30 text-navy-dark"}`}>
                                {vs.name}
                              </span>
                              {isWinner && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">Winner</span>}
                            </div>
                          </td>
                          <td className="py-2.5 pr-4 max-w-xs truncate text-ink">{vs.subject}</td>
                          <td className="py-2.5 pr-4 text-right font-medium">{vs.sent}</td>
                          <td className="py-2.5 pr-4 text-right font-medium">{vs.opened}</td>
                          <td className="py-2.5 pr-4 text-right font-bold text-green-700">{pct(vs.openRate)}</td>
                          <td className="py-2.5 text-right font-bold text-blue-700">{pct(vs.clickRate)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="space-y-5">
          <div className="rounded-2xl border border-navy/8 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-widest text-ink-soft">Delivery</h2>
              {campaign.status === "SENT" && (
                <button onClick={refreshMetrics} disabled={refreshing}
                  className="text-xs font-semibold text-navy hover:underline disabled:opacity-60">
                  {refreshing ? "Refreshing…" : "Refresh"}
                </button>
              )}
            </div>
            <div className="space-y-3">
              {attributedCount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-ink-soft">Attributed contacts</span>
                  <span className="font-bold text-navy">{attributedCount}</span>
                </div>
              )}
              {conversionCount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-ink-soft">New members (30 days)</span>
                  <span className="font-bold text-green-700">{conversionCount}</span>
                </div>
              )}
              {conversionRevenue > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-ink-soft">Conversion MRR</span>
                  <span className="font-bold text-green-700">
                    {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(conversionRevenue / 100)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-ink-soft">Queued</span>
                <span className="font-bold text-navy">{campaign.sendCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink-soft">Sent</span>
                <span className="font-bold text-navy">{metric?.totalSent ?? "—"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink-soft">Delivered</span>
                <span className="font-bold text-navy">{metric?.totalDelivered ?? "—"}</span>
              </div>
              {metric && metric.totalBounced > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-ink-soft">Bounced</span>
                  <span className="font-bold text-red-600">{metric.totalBounced}</span>
                </div>
              )}
              {metric && metric.totalUnsubscribed > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-ink-soft">Cancelled (pre-send)</span>
                  <span className="font-bold text-navy">{metric.totalUnsubscribed}</span>
                </div>
              )}
            </div>
          </div>

          {(metric || campaign.status === "SENT") && (
            <div className="rounded-2xl border border-navy/8 bg-white p-5">
              <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-ink-soft">Engagement</h2>
              {!metric ? (
                <p className="text-sm text-ink-soft">No metrics yet — click Refresh above.</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-ink-soft">Opened</span>
                    <span className="font-bold text-navy">{metric.totalOpened}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-ink-soft">Clicked</span>
                    <span className="font-bold text-navy">{metric.totalClicked}</span>
                  </div>
                  <div className="mt-3 border-t border-navy/8 pt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-ink-soft">Open rate</span>
                      <span className="font-bold text-green-700">{pct(metric.openRate)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-ink-soft">Click rate</span>
                      <span className="font-bold text-blue-700">{pct(metric.clickRate)}</span>
                    </div>
                    {metric.totalBounced > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-ink-soft">Bounce rate</span>
                        <span className="font-bold text-red-600">{pct(metric.bounceRate)}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-ink-soft/60">
                    Computed {new Date(metric.computedAt).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

AdminCampaignDetailPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;
export default AdminCampaignDetailPage;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return { redirect: { destination: "/", permanent: false } };
  }

  const { id } = ctx.params as { id: string };

  type VarDb = {
    campaignVariant: {
      findMany: (a: unknown) => Promise<{
        id: string; name: string; subject: string; fromName: string; fromEmail: string;
        htmlBody: string; textBody: string | null; splitPct: number; createdAt: Date;
      }[]>;
    };
  };
  const varDb = db as never as VarDb;

  const campaign = await db.campaign.findUnique({
    where: { id },
    include: {
      list: { select: { name: true } },
      _count: { select: { sends: true } },
      metric: true,
    },
  });
  if (!campaign) return { notFound: true };

  const isAbTest = (campaign as unknown as { isAbTest: boolean }).isAbTest ?? false;
  const channelType = (campaign as unknown as { channelType: string }).channelType ?? "EMAIL";
  const pushUrl = (campaign as unknown as { pushUrl: string | null }).pushUrl ?? null;
  const pushIcon = (campaign as unknown as { pushIcon: string | null }).pushIcon ?? null;

  // Build a human-readable summary of audienceRules for display
  type RuleShape = { type: string; listId?: string; role?: string; tag?: string; topic?: string; label?: string };
  type AudDef = { include: RuleShape[]; exclude: RuleShape[] } | null;
  const aud = campaign.audienceRules as AudDef;
  const audienceRuleSummary: AudienceRuleSummary[] = aud
    ? [
        ...aud.include.map((r) => ({
          type: r.type,
          label: r.label ?? r.role ?? r.tag ?? r.topic ?? r.listId ?? "?",
        })),
        ...aud.exclude.map((r) => ({
          type: `exclude:${r.type}`,
          label: r.label ?? r.role ?? r.tag ?? r.topic ?? r.listId ?? "?",
        })),
      ]
    : [];

  const m = campaign.metric;

  const attributedCount = await (db as never as { contactAttribution: { count: (a: unknown) => Promise<number> } })
    .contactAttribution.count({ where: { campaignId: id } as never });

  // Campaign conversion: new memberships created within 30 days of send, from contacts in this campaign
  let conversionCount = 0;
  let conversionRevenue = 0;
  if (campaign.sentAt) {
    const windowStart = campaign.sentAt;
    const windowEnd = new Date(campaign.sentAt.getTime() + 30 * 24 * 60 * 60 * 1000);

    const sendContacts = await db.campaignSend.findMany({
      where: { campaignId: id },
      select: { contactId: true },
    });
    const contactIds = sendContacts.map((s) => s.contactId);

    if (contactIds.length > 0) {
      const linkedContacts = await db.contact.findMany({
        where: { id: { in: contactIds }, userId: { not: null } },
        select: { userId: true },
      });
      const userIds = linkedContacts.map((c) => c.userId).filter((u): u is string => u !== null);

      if (userIds.length > 0) {
        const conversions = await db.userMembership.findMany({
          where: {
            userId: { in: userIds },
            createdAt: { gte: windowStart, lte: windowEnd },
          },
          include: { price: true },
        });
        conversionCount = conversions.length;
        conversionRevenue = conversions.reduce((sum, m) => {
          const monthly = (m.price.interval === "ANNUAL" ? m.price.amount / 12 : m.price.amount);
          return sum + Math.round(monthly);
        }, 0);
      }
    }
  }

  // Load variants
  const variantRows = await varDb.campaignVariant.findMany({
    where: { campaignId: id } as never,
    orderBy: { createdAt: "asc" } as never,
  });

  // Compute per-variant stats (only meaningful after send)
  type SendStatRow = { variantId: string | null; status: string };
  const allSendStats: SendStatRow[] = campaign.status === "SENT"
    ? await (db as never as { campaignSend: { findMany: (a: unknown) => Promise<SendStatRow[]> } })
        .campaignSend.findMany({
          where: { campaignId: id } as never,
          select: { variantId: true, status: true } as never,
        })
    : [];

  function computeVariantStat(vsRows: SendStatRow[], variantId: string | null, name: string, subject: string): VariantStat {
    const rows = vsRows.filter((r) => r.variantId === variantId);
    const sent = rows.filter((r) => ["SENT", "OPENED", "CLICKED", "BOUNCED"].includes(r.status)).length;
    const opened = rows.filter((r) => r.status === "OPENED" || r.status === "CLICKED").length;
    const clicked = rows.filter((r) => r.status === "CLICKED").length;
    const delivered = rows.filter((r) => ["SENT", "OPENED", "CLICKED"].includes(r.status)).length;
    return {
      variantId,
      name,
      subject,
      sent,
      opened,
      clicked,
      openRate: delivered > 0 ? opened / delivered : 0,
      clickRate: delivered > 0 ? clicked / delivered : 0,
    };
  }

  const variantStats: VariantStat[] = allSendStats.length > 0
    ? [
        computeVariantStat(allSendStats, null, "A", campaign.subject),
        ...variantRows.map((v) => computeVariantStat(allSendStats, v.id, v.name, v.subject)),
      ].filter((s) => s.sent > 0)
    : [];

  const occurrenceRows = campaign.isRecurring && !campaign.parentCampaignId
    ? await db.campaign.findMany({
        where: { parentCampaignId: id },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { _count: { select: { sends: true } } },
      })
    : [];

  return {
    props: {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        channelType,
        subject: campaign.subject,
        fromName: campaign.fromName,
        fromEmail: campaign.fromEmail,
        htmlBody: campaign.htmlBody,
        textBody: campaign.textBody,
        pushUrl,
        pushIcon,
        listId: campaign.listId,
        listName: campaign.list?.name ?? null,
        hasAudienceRules: !!aud && aud.include.length > 0,
        audienceRuleSummary,
        sendCount: campaign._count.sends,
        scheduledAt: campaign.scheduledAt?.toISOString() ?? null,
        sentAt: campaign.sentAt?.toISOString() ?? null,
        createdAt: campaign.createdAt.toISOString(),
        isAbTest,
        isAmbassadorMaterial: (campaign as unknown as { isAmbassadorMaterial: boolean }).isAmbassadorMaterial ?? false,
        isRecurring: campaign.isRecurring,
        parentCampaignId: campaign.parentCampaignId,
        recurrenceTime: campaign.recurrenceTime,
        recurrenceSource: campaign.recurrenceSource,
        recurrenceActive: campaign.recurrenceActive,
      },
      variants: variantRows.map((v) => ({
        id: v.id, name: v.name, subject: v.subject, fromName: v.fromName, fromEmail: v.fromEmail,
        htmlBody: v.htmlBody, textBody: v.textBody, splitPct: v.splitPct, createdAt: v.createdAt.toISOString(),
      })),
      variantStats,
      attributedCount,
      conversionCount,
      conversionRevenue,
      occurrences: occurrenceRows.map((o) => ({
        id: o.id,
        name: o.name,
        subject: o.subject,
        status: o.status,
        sentAt: o.sentAt?.toISOString() ?? null,
        sendCount: o._count.sends,
      })),
      metric: m ? {
        totalSent: m.totalSent,
        totalDelivered: m.totalDelivered,
        totalOpened: m.totalOpened,
        totalClicked: m.totalClicked,
        totalBounced: m.totalBounced,
        totalUnsubscribed: m.totalUnsubscribed,
        openRate: m.openRate,
        clickRate: m.clickRate,
        bounceRate: m.bounceRate,
        unsubRate: m.unsubRate,
        computedAt: m.computedAt.toISOString(),
      } : null,
    },
  };
};

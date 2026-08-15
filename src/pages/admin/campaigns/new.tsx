import Head from "next/head";
import { useRouter } from "next/router";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

interface ListOption { id: string; name: string; _count: { members: number } }
interface TemplateOption { id: string; name: string; subject: string; htmlBody: string; textBody: string | null }

interface Props {
  lists: ListOption[];
  templates: TemplateOption[];
}

const STEPS = ["Details", "Content", "Audience & Schedule"] as const;

const AdminNewCampaignPage: NextPageWithLayout<Props> = ({ lists, templates }) => {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Details
  const [name, setName] = useState("");
  const [fromName, setFromName] = useState("Fixer Nation");
  const [fromEmail, setFromEmail] = useState("campaigns@fixernation.org");

  // Step 2: Content
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [textBody, setTextBody] = useState("");

  // Step 3: Audience & Schedule
  const [listId, setListId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  function applyTemplate(id: string) {
    setSelectedTemplateId(id);
    if (!id) return;
    const t = templates.find((t) => t.id === id);
    if (!t) return;
    if (!subject) setSubject(t.subject);
    setHtmlBody(t.htmlBody);
    setTextBody(t.textBody ?? "");
  }

  function canAdvance() {
    if (step === 0) return name.trim().length > 0;
    if (step === 1) return subject.trim().length > 0 && htmlBody.trim().length > 0;
    return true;
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      const body = {
        name,
        subject,
        fromName,
        fromEmail,
        htmlBody,
        textBody: textBody || undefined,
        templateId: selectedTemplateId || undefined,
        listId: listId || undefined,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      };
      const res = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? data.error ?? "Failed to create campaign");
      }
      const campaign = await res.json();
      router.push(`/admin/campaigns/${campaign.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  }

  return (
    <>
      <Head><title>New Campaign — Admin</title></Head>
      <div className="mx-auto max-w-2xl">
        {/* Breadcrumb */}
        <div className="mb-4 flex items-center gap-2 text-sm text-ink-soft">
          <a href="/admin/campaigns" className="hover:underline">Campaigns</a>
          <span>/</span>
          <span>New campaign</span>
        </div>

        <h1 className="mb-6 text-2xl font-extrabold text-navy">New campaign</h1>

        {/* Step indicator */}
        <div className="mb-8 flex items-center gap-0">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center">
              <div className="flex items-center gap-2">
                <div className={[
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                  i < step ? "bg-green-600 text-white" :
                  i === step ? "bg-navy text-white" :
                  "bg-gray-100 text-gray-400",
                ].join(" ")}>
                  {i < step ? "✓" : i + 1}
                </div>
                <span className={[
                  "text-sm font-semibold",
                  i === step ? "text-navy" : "text-gray-400",
                ].join(" ")}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={["mx-3 h-px w-10", i < step ? "bg-green-600" : "bg-gray-200"].join(" ")} />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* Step 1: Details */}
        {step === 0 && (
          <div className="space-y-5 rounded-2xl border border-navy/8 bg-white p-6">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Campaign name *</label>
              <input
                autoFocus
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. August newsletter"
                className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              />
              <p className="mt-1 text-xs text-ink-soft">Internal name — not shown to recipients</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">From name</label>
                <input
                  type="text"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">From email</label>
                <input
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Content */}
        {step === 1 && (
          <div className="space-y-5 rounded-2xl border border-navy/8 bg-white p-6">
            {templates.length > 0 && (
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">
                  Start from a template <span className="font-normal normal-case">(optional)</span>
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => applyTemplate(e.target.value)}
                  className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                >
                  <option value="">— Start from scratch —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {selectedTemplateId && (
                  <p className="mt-1 text-xs text-green-700">Template loaded. You can edit the subject and body below.</p>
                )}
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Subject line *</label>
              <input
                autoFocus={!selectedTemplateId}
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Your monthly update from Fixer Nation"
                className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">HTML body *</label>
              <textarea
                value={htmlBody}
                onChange={(e) => setHtmlBody(e.target.value)}
                rows={12}
                placeholder="Paste your HTML email body here…"
                className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-navy/30"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Plain text (optional)</label>
              <textarea
                value={textBody}
                onChange={(e) => setTextBody(e.target.value)}
                rows={4}
                placeholder="Plain text fallback…"
                className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-navy/30"
              />
            </div>
          </div>
        )}

        {/* Step 3: Audience & Schedule */}
        {step === 2 && (
          <div className="space-y-5 rounded-2xl border border-navy/8 bg-white p-6">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Send to list</label>
              <select
                value={listId}
                onChange={(e) => setListId(e.target.value)}
                className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              >
                <option value="">— Select a list (optional) —</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l._count.members.toLocaleString()} contacts)
                  </option>
                ))}
              </select>
              {!listId && (
                <p className="mt-1 text-xs text-ink-soft">You can assign a list later from the campaign page.</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Schedule (optional)</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              />
              <p className="mt-1 text-xs text-ink-soft">Leave blank to save as draft. You can send manually from the campaign page.</p>
            </div>

            {/* Summary */}
            <div className="rounded-xl bg-cream-panel p-4 text-sm space-y-1">
              <p className="font-semibold text-navy">Review before saving</p>
              <p className="text-ink-soft"><span className="font-medium text-ink">Name:</span> {name}</p>
              <p className="text-ink-soft"><span className="font-medium text-ink">Subject:</span> {subject}</p>
              <p className="text-ink-soft"><span className="font-medium text-ink">From:</span> {fromName} &lt;{fromEmail}&gt;</p>
              <p className="text-ink-soft"><span className="font-medium text-ink">List:</span> {listId ? lists.find(l => l.id === listId)?.name : "None (draft)"}</p>
              <p className="text-ink-soft"><span className="font-medium text-ink">Schedule:</span> {scheduledAt ? new Date(scheduledAt).toLocaleString() : "Send manually"}</p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-6 flex gap-3">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="rounded-xl border border-navy/15 px-5 py-2.5 text-sm font-bold text-ink-soft hover:bg-cream-panel"
            >
              Back
            </button>
          )}

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              disabled={!canAdvance()}
              onClick={() => setStep((s) => s + 1)}
              className="rounded-xl bg-navy px-5 py-2.5 text-sm font-bold text-white hover:bg-navy-dark disabled:opacity-40"
            >
              Next: {STEPS[step + 1]}
            </button>
          ) : (
            <button
              type="button"
              disabled={saving || !canAdvance()}
              onClick={handleSubmit}
              className="rounded-xl bg-navy px-5 py-2.5 text-sm font-bold text-white hover:bg-navy-dark disabled:opacity-60"
            >
              {saving ? "Saving…" : scheduledAt ? "Save and schedule" : "Save as draft"}
            </button>
          )}

          <a
            href="/admin/campaigns"
            className="rounded-xl border border-navy/15 px-5 py-2.5 text-sm font-bold text-ink-soft hover:bg-cream-panel no-underline"
          >
            Cancel
          </a>
        </div>
      </div>
    </>
  );
};

AdminNewCampaignPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;
export default AdminNewCampaignPage;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return { redirect: { destination: "/", permanent: false } };
  }

  const [lists, templates] = await Promise.all([
    db.contactList.findMany({
      where: { ownerType: "FN_ADMIN" },
      select: { id: true, name: true, _count: { select: { members: true } } },
      orderBy: { name: "asc" },
    }),
    db.emailTemplate.findMany({
      select: { id: true, name: true, subject: true, htmlBody: true, textBody: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return { props: { lists, templates } };
};

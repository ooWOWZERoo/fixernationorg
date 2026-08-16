import Head from "next/head";
import { useRouter } from "next/router";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { BlockComposer } from "@/components/email/BlockComposer";
import { AudienceBuilder } from "@/components/email/AudienceBuilder";
import type { AudienceDefinition } from "@/lib/audience";
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
  const [channelType, setChannelType] = useState<"EMAIL" | "PUSH">("EMAIL");
  const [name, setName] = useState("");
  const [fromName, setFromName] = useState("Fixer Nation");
  const [fromEmail, setFromEmail] = useState("campaigns@fixernation.org");

  // Step 2: Content (email)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [textBody, setTextBody] = useState("");
  const [useComposer, setUseComposer] = useState(true);

  // Step 2: Content (push)
  const [pushUrl, setPushUrl] = useState("");
  const [pushIcon, setPushIcon] = useState("");

  // Step 3: Audience & Schedule
  const [audienceRules, setAudienceRules] = useState<AudienceDefinition>({
    logic: "OR",
    include: [],
    exclude: [],
  });
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
    if (step === 1) {
      if (channelType === "PUSH") return subject.trim().length > 0 && textBody.trim().length > 0;
      return subject.trim().length > 0 && htmlBody.trim().length > 0;
    }
    return true;
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      const body = channelType === "PUSH"
        ? {
            channelType: "PUSH" as const,
            name,
            subject,
            textBody: textBody || undefined,
            pushUrl: pushUrl || undefined,
            pushIcon: pushIcon || undefined,
            audienceRules: audienceRules.include.length > 0 ? audienceRules : undefined,
            scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
          }
        : {
            name,
            subject,
            fromName,
            fromEmail,
            htmlBody,
            textBody: textBody || undefined,
            templateId: selectedTemplateId || undefined,
            audienceRules: audienceRules.include.length > 0 ? audienceRules : undefined,
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
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-ink-soft">Channel</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setChannelType("EMAIL")}
                  className={[
                    "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors",
                    channelType === "EMAIL"
                      ? "border-navy bg-navy text-white"
                      : "border-navy/15 text-ink-soft hover:bg-cream-panel",
                  ].join(" ")}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  Email
                </button>
                <button
                  type="button"
                  onClick={() => setChannelType("PUSH")}
                  className={[
                    "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors",
                    channelType === "PUSH"
                      ? "border-navy bg-navy text-white"
                      : "border-navy/15 text-ink-soft hover:bg-cream-panel",
                  ].join(" ")}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                  Browser notification
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Campaign name *</label>
              <input
                autoFocus
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={channelType === "PUSH" ? "e.g. New content alert" : "e.g. August newsletter"}
                className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              />
              <p className="mt-1 text-xs text-ink-soft">Internal name — not shown to recipients</p>
            </div>

            {channelType === "EMAIL" && (
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
            )}
          </div>
        )}

        {/* Step 2: Push notification content */}
        {step === 1 && channelType === "PUSH" && (
          <div className="space-y-5 rounded-2xl border border-navy/8 bg-white p-6">
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              Recipients must have granted notification permission in their browser.
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Notification title *</label>
              <input
                autoFocus
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={80}
                placeholder="e.g. New content just dropped"
                className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              />
              <p className="mt-1 text-xs text-ink-soft">{subject.length}/80 characters</p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Message *</label>
              <textarea
                value={textBody}
                onChange={(e) => setTextBody(e.target.value)}
                rows={3}
                maxLength={150}
                placeholder="Short message shown under the title…"
                className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              />
              <p className="mt-1 text-xs text-ink-soft">{textBody.length}/150 characters</p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Click URL <span className="font-normal normal-case">(optional)</span></label>
              <input
                type="url"
                value={pushUrl}
                onChange={(e) => setPushUrl(e.target.value)}
                placeholder="https://fixernation.org/…"
                className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              />
              <p className="mt-1 text-xs text-ink-soft">Where to send the user when they tap the notification. Defaults to the homepage.</p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Icon URL <span className="font-normal normal-case">(optional)</span></label>
              <input
                type="url"
                value={pushIcon}
                onChange={(e) => setPushIcon(e.target.value)}
                placeholder="https://fixernation.org/icons/icon-192.png"
                className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              />
            </div>
          </div>
        )}

        {/* Step 2: Email content */}
        {step === 1 && channelType === "EMAIL" && (
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
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-widest text-ink-soft">Email body *</label>
                <div className="flex rounded-lg border border-navy/15 overflow-hidden text-xs font-medium">
                  <button type="button" onClick={() => setUseComposer(true)}
                    className={`px-3 py-1 ${useComposer ? "bg-navy text-white" : "text-ink-soft hover:bg-cream-panel"}`}>
                    Visual
                  </button>
                  <button type="button" onClick={() => setUseComposer(false)}
                    className={`px-3 py-1 ${!useComposer ? "bg-navy text-white" : "text-ink-soft hover:bg-cream-panel"}`}>
                    HTML
                  </button>
                </div>
              </div>
              {useComposer ? (
                <BlockComposer onChange={setHtmlBody} />
              ) : (
                <textarea
                  value={htmlBody}
                  onChange={(e) => setHtmlBody(e.target.value)}
                  rows={12}
                  placeholder="Paste your HTML email body here…"
                  className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-navy/30"
                />
              )}
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
          <div className="space-y-5">
            <div className="rounded-2xl border border-navy/8 bg-white p-6">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-ink-soft">Audience</h2>
              <AudienceBuilder
                value={audienceRules}
                onChange={setAudienceRules}
                lists={lists.map((l) => ({ id: l.id, name: `${l.name} (${l._count.members.toLocaleString()})` }))}
              />
              {audienceRules.include.length === 0 && (
                <p className="mt-3 text-xs text-ink-soft">No audience defined — you can add rules here or configure this after saving.</p>
              )}
            </div>

            <div className="rounded-2xl border border-navy/8 bg-white p-6">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-ink-soft">Schedule</h2>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Send time (optional)</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                />
                <p className="mt-1 text-xs text-ink-soft">Leave blank to save as draft and send manually.</p>
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-xl bg-cream-panel p-4 text-sm space-y-1">
              <p className="font-semibold text-navy">Review before saving</p>
              <p className="text-ink-soft"><span className="font-medium text-ink">Channel:</span> {channelType === "PUSH" ? "Browser notification" : "Email"}</p>
              <p className="text-ink-soft"><span className="font-medium text-ink">Name:</span> {name}</p>
              <p className="text-ink-soft"><span className="font-medium text-ink">{channelType === "PUSH" ? "Title" : "Subject"}:</span> {subject}</p>
              {channelType === "EMAIL" && (
                <p className="text-ink-soft"><span className="font-medium text-ink">From:</span> {fromName} &lt;{fromEmail}&gt;</p>
              )}
              <p className="text-ink-soft">
                <span className="font-medium text-ink">Audience:</span>{" "}
                {audienceRules.include.length > 0
                  ? `${audienceRules.include.length} include rule${audienceRules.include.length !== 1 ? "s" : ""}${audienceRules.exclude.length > 0 ? `, ${audienceRules.exclude.length} exclusion${audienceRules.exclude.length !== 1 ? "s" : ""}` : ""}`
                  : "Not defined (can be set after saving)"}
              </p>
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

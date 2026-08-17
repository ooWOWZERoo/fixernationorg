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
import { blocksToHtml, type EmailBlock } from "@/lib/email-blocks";
import type { AudienceDefinition } from "@/lib/audience";
import type { NextPageWithLayout } from "@/types/next";

interface ListOption { id: string; name: string; _count: { members: number } }
interface TemplateOption { id: string; name: string; subject: string; htmlBody: string; textBody: string | null }

interface Props { lists: ListOption[]; templates: TemplateOption[] }

const STEPS = [
  "Details",
  "Content",
  "UTM & Tracking",
  "Test Send",
  "Audience",
  "Schedule",
  "Review",
] as const;

const AdminNewCampaignPage: NextPageWithLayout<Props> = ({ lists, templates }) => {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 0 — Details
  const [channelType, setChannelType] = useState<"EMAIL" | "PUSH">("EMAIL");
  const [name, setName] = useState("");
  const [fromName, setFromName] = useState("Fixer Nation");
  const [fromEmail, setFromEmail] = useState("campaigns@fixernation.org");

  // Step 1 — Content (email)
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [textBody, setTextBody] = useState("");
  const [emailBlocks, setEmailBlocks] = useState<EmailBlock[]>([]);
  const [useComposer, setUseComposer] = useState(true);

  // Step 1 — Content (push)
  const [pushUrl, setPushUrl] = useState("");
  const [pushIcon, setPushIcon] = useState("");

  // Step 2 — UTM & Tracking
  const [utmSource, setUtmSource] = useState("email");
  const [utmMedium, setUtmMedium] = useState("campaign");
  const [utmCampaign, setUtmCampaign] = useState("");
  const [openTracking, setOpenTracking] = useState(true);
  const [clickTracking, setClickTracking] = useState(true);

  // Step 3 — Test Send
  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Step 4 — Audience
  const [audienceRules, setAudienceRules] = useState<AudienceDefinition>({ logic: "OR", include: [], exclude: [] });
  const [audiencePreview, setAudiencePreview] = useState<{ count: number } | null>(null);
  const [previewingAudience, setPreviewingAudience] = useState(false);

  // Step 5 — Schedule
  const [scheduledAt, setScheduledAt] = useState("");

  function applyTemplate(id: string) {
    setSelectedTemplateId(id);
    if (!id) return;
    const t = templates.find(t => t.id === id);
    if (!t) return;
    if (!subject) setSubject(t.subject);
    setHtmlBody(t.htmlBody);
    setTextBody(t.textBody ?? "");
  }

  function buildFinalHtml(): string {
    if (emailBlocks.length === 0) return htmlBody;
    const applyUtm = utmSource || utmMedium || utmCampaign;
    if (!applyUtm) return htmlBody;
    return blocksToHtml(emailBlocks.map(b => {
      if (b.type !== "button" || b.utmSource || b.utmMedium || b.utmCampaign) return b;
      return { ...b, utmSource, utmMedium, utmCampaign };
    }));
  }

  async function previewAudience() {
    if (audienceRules.include.length === 0) return;
    setPreviewingAudience(true);
    try {
      const res = await fetch("/api/admin/campaigns/preview-audience", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: audienceRules }),
      });
      if (res.ok) {
        const data = await res.json();
        setAudiencePreview({ count: data.count ?? 0 });
      }
    } catch { /* silent */ }
    setPreviewingAudience(false);
  }

  async function sendTest() {
    if (!testEmail.trim()) return;
    setTestSending(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/campaigns/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: testEmail,
          subject,
          htmlBody: buildFinalHtml(),
          textBody: textBody || undefined,
          fromName,
          fromEmail,
        }),
      });
      const data = await res.json();
      setTestResult(res.ok
        ? { ok: true, message: `Test sent to ${testEmail}` }
        : { ok: false, message: data.error ?? "Failed to send test" }
      );
    } catch {
      setTestResult({ ok: false, message: "Failed to send test" });
    }
    setTestSending(false);
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
      const finalHtml = buildFinalHtml();
      const body = channelType === "PUSH"
        ? {
            channelType: "PUSH" as const,
            name, subject, textBody: textBody || undefined,
            pushUrl: pushUrl || undefined, pushIcon: pushIcon || undefined,
            audienceRules: audienceRules.include.length > 0 ? audienceRules : undefined,
            scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
          }
        : {
            name, subject, fromName, fromEmail,
            htmlBody: finalHtml,
            textBody: textBody || undefined,
            templateId: selectedTemplateId || undefined,
            audienceRules: audienceRules.include.length > 0 ? audienceRules : undefined,
            scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
            metadata: {
              utmSource: utmSource || undefined,
              utmMedium: utmMedium || undefined,
              utmCampaign: utmCampaign || undefined,
              openTracking,
              clickTracking,
            },
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
      if (typeof window !== "undefined") {
        try { localStorage.removeItem("campaign_composer_draft"); } catch { /* ignore */ }
      }
      router.push(`/admin/campaigns/${campaign.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  }

  const isEmailCampaign = channelType === "EMAIL";

  return (
    <>
      <Head><title>New Campaign — Admin</title></Head>
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center gap-2 text-sm text-ink-soft">
          <a href="/admin/campaigns" className="hover:underline">Campaigns</a>
          <span>/</span>
          <span>New campaign</span>
        </div>

        <h1 className="mb-6 text-2xl font-extrabold text-navy">New campaign</h1>

        {/* Step indicator — scrollable on mobile */}
        <div className="mb-8 overflow-x-auto">
          <div className="flex items-center gap-0 min-w-max">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center">
                <div className="flex items-center gap-1.5">
                  <div className={[
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    i < step ? "bg-green-600 text-white" : i === step ? "bg-navy text-white" : "bg-gray-100 text-gray-400",
                  ].join(" ")}>
                    {i < step ? "✓" : i + 1}
                  </div>
                  <span className={["text-xs font-semibold whitespace-nowrap", i === step ? "text-navy" : "text-gray-400"].join(" ")}>
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={["mx-2 h-px w-6 shrink-0", i < step ? "bg-green-600" : "bg-gray-200"].join(" ")} />
                )}
              </div>
            ))}
          </div>
        </div>

        {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {/* ── Step 0: Details ── */}
        {step === 0 && (
          <div className="space-y-5 rounded-2xl border border-navy/8 bg-white p-6">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-ink-soft">Channel</label>
              <div className="flex gap-3">
                {(["EMAIL", "PUSH"] as const).map(ch => (
                  <button key={ch} type="button" onClick={() => setChannelType(ch)}
                    className={["flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors",
                      channelType === ch ? "border-navy bg-navy text-white" : "border-navy/15 text-ink-soft hover:bg-cream-panel"].join(" ")}>
                    {ch === "EMAIL" ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                    )}
                    {ch === "EMAIL" ? "Email" : "Browser notification"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Campaign name *</label>
              <input autoFocus type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder={channelType === "PUSH" ? "New content alert" : "August newsletter"}
                className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
              <p className="mt-1 text-xs text-ink-soft">Internal name — not shown to recipients</p>
            </div>

            {isEmailCampaign && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">From name</label>
                  <input type="text" value={fromName} onChange={e => setFromName(e.target.value)}
                    className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">From email</label>
                  <input type="email" value={fromEmail} onChange={e => setFromEmail(e.target.value)}
                    className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 1: Content (push) ── */}
        {step === 1 && !isEmailCampaign && (
          <div className="space-y-5 rounded-2xl border border-navy/8 bg-white p-6">
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              Recipients must have granted notification permission in their browser.
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Notification title *</label>
              <input autoFocus type="text" value={subject} onChange={e => setSubject(e.target.value)} maxLength={80}
                placeholder="New content just dropped"
                className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
              <p className="mt-1 text-xs text-ink-soft">{subject.length}/80 characters</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Message *</label>
              <textarea value={textBody} onChange={e => setTextBody(e.target.value)} rows={3} maxLength={150}
                placeholder="Short message shown under the title…"
                className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
              <p className="mt-1 text-xs text-ink-soft">{textBody.length}/150 characters</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Click URL <span className="font-normal normal-case">(optional)</span></label>
              <input type="url" value={pushUrl} onChange={e => setPushUrl(e.target.value)} placeholder="https://fixernation.org/…"
                className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Icon URL <span className="font-normal normal-case">(optional)</span></label>
              <input type="url" value={pushIcon} onChange={e => setPushIcon(e.target.value)} placeholder="https://fixernation.org/icons/icon-192.png"
                className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
            </div>
          </div>
        )}

        {/* ── Step 1: Content (email) ── */}
        {step === 1 && isEmailCampaign && (
          <div className="space-y-5 rounded-2xl border border-navy/8 bg-white p-6">
            {templates.length > 0 && (
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Start from a template <span className="font-normal normal-case">(optional)</span></label>
                <select value={selectedTemplateId} onChange={e => applyTemplate(e.target.value)}
                  className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30">
                  <option value="">— Start from scratch —</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Subject line *</label>
              <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
                placeholder="Your monthly update from Fixer Nation"
                className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-widest text-ink-soft">Email body *</label>
                <div className="flex overflow-hidden rounded-lg border border-navy/15 text-xs font-medium">
                  <button type="button" onClick={() => setUseComposer(true)}
                    className={`px-3 py-1 ${useComposer ? "bg-navy text-white" : "text-ink-soft hover:bg-cream-panel"}`}>Visual</button>
                  <button type="button" onClick={() => setUseComposer(false)}
                    className={`px-3 py-1 ${!useComposer ? "bg-navy text-white" : "text-ink-soft hover:bg-cream-panel"}`}>HTML</button>
                </div>
              </div>
              {useComposer ? (
                <BlockComposer
                  onChange={(html, blocks) => { setHtmlBody(html); setEmailBlocks(blocks); }}
                  autosaveKey="campaign_composer_draft"
                />
              ) : (
                <textarea value={htmlBody} onChange={e => setHtmlBody(e.target.value)} rows={12}
                  placeholder="Paste your HTML email body here…"
                  className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-navy/30" />
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Plain text <span className="font-normal normal-case">(optional)</span></label>
              <textarea value={textBody} onChange={e => setTextBody(e.target.value)} rows={4}
                placeholder="Plain text fallback…"
                className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-navy/30" />
            </div>
          </div>
        )}

        {/* ── Step 2: UTM & Tracking ── */}
        {step === 2 && (
          <div className="space-y-6 rounded-2xl border border-navy/8 bg-white p-6">
            {!isEmailCampaign ? (
              <p className="text-sm text-ink-soft">UTM tracking is not applicable to browser notifications. Continue to the next step.</p>
            ) : (
              <>
                <div>
                  <h2 className="mb-1 text-sm font-bold text-navy">UTM parameters</h2>
                  <p className="mb-4 text-xs text-ink-soft">
                    These values will be appended to button links in your email that don't already have UTM parameters set.
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">utm_source</label>
                      <input type="text" value={utmSource} onChange={e => setUtmSource(e.target.value)} placeholder="email"
                        className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">utm_medium</label>
                      <input type="text" value={utmMedium} onChange={e => setUtmMedium(e.target.value)} placeholder="campaign"
                        className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">utm_campaign</label>
                      <input type="text" value={utmCampaign} onChange={e => setUtmCampaign(e.target.value)}
                        placeholder={name || "campaign-name"}
                        className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
                    </div>
                  </div>
                </div>

                <div className="border-t border-navy/8 pt-5">
                  <h2 className="mb-3 text-sm font-bold text-navy">Tracking options</h2>
                  <div className="space-y-3">
                    <label className="flex cursor-pointer items-start gap-3">
                      <input type="checkbox" checked={openTracking} onChange={e => setOpenTracking(e.target.checked)}
                        className="mt-0.5 h-4 w-4 cursor-pointer accent-navy" />
                      <span>
                        <span className="block text-sm font-semibold text-ink">Open tracking</span>
                        <span className="block text-xs text-ink-soft">Injects a 1×1 tracking pixel to measure email opens.</span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-3">
                      <input type="checkbox" checked={clickTracking} onChange={e => setClickTracking(e.target.checked)}
                        className="mt-0.5 h-4 w-4 cursor-pointer accent-navy" />
                      <span>
                        <span className="block text-sm font-semibold text-ink">Click tracking</span>
                        <span className="block text-xs text-ink-soft">Wraps links with a tracking redirect to measure click-throughs.</span>
                      </span>
                    </label>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Step 3: Test Send ── */}
        {step === 3 && (
          <div className="space-y-6 rounded-2xl border border-navy/8 bg-white p-6">
            {!isEmailCampaign ? (
              <p className="text-sm text-ink-soft">Test sends are only available for email campaigns. Continue to the next step.</p>
            ) : !subject || !htmlBody ? (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                Go back to step 2 and complete your subject line and email body before sending a test.
              </div>
            ) : (
              <>
                <div>
                  <h2 className="mb-1 text-sm font-bold text-navy">Send a test email</h2>
                  <p className="mb-4 text-xs text-ink-soft">
                    The test email is sent immediately with a banner showing it's a test. UTM parameters from step 3 are included.
                  </p>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Send test to</label>
                  <div className="flex gap-3">
                    <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="flex-1 rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
                    <button type="button" onClick={sendTest}
                      disabled={testSending || !testEmail.trim()}
                      className="rounded-xl bg-navy px-5 py-2 text-sm font-bold text-white hover:bg-navy-dark disabled:opacity-40">
                      {testSending ? "Sending…" : "Send test"}
                    </button>
                  </div>
                  {testResult && (
                    <p className={`mt-2 text-sm font-semibold ${testResult.ok ? "text-green-700" : "text-red-600"}`}>
                      {testResult.message}
                    </p>
                  )}
                </div>

                <div className="border-t border-navy/8 pt-5">
                  <h2 className="mb-3 text-sm font-bold text-navy">Campaign details so far</h2>
                  <dl className="space-y-1.5 text-sm">
                    <div className="flex gap-2"><dt className="w-24 shrink-0 font-semibold text-ink">Name:</dt><dd className="text-ink-soft">{name}</dd></div>
                    <div className="flex gap-2"><dt className="w-24 shrink-0 font-semibold text-ink">Subject:</dt><dd className="text-ink-soft">{subject}</dd></div>
                    <div className="flex gap-2"><dt className="w-24 shrink-0 font-semibold text-ink">From:</dt><dd className="text-ink-soft">{fromName} &lt;{fromEmail}&gt;</dd></div>
                    {utmCampaign && <div className="flex gap-2"><dt className="w-24 shrink-0 font-semibold text-ink">UTM:</dt><dd className="text-ink-soft font-mono text-xs">{utmSource}/{utmMedium}/{utmCampaign}</dd></div>}
                  </dl>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Step 4: Audience ── */}
        {step === 4 && (
          <div className="rounded-2xl border border-navy/8 bg-white p-6">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-ink-soft">Audience</h2>
            <AudienceBuilder
              value={audienceRules}
              onChange={v => { setAudienceRules(v); setAudiencePreview(null); }}
              lists={lists.map(l => ({ id: l.id, name: `${l.name} (${l._count.members.toLocaleString()})` }))}
            />
            {audienceRules.include.length === 0 ? (
              <p className="mt-3 text-xs text-ink-soft">No audience defined — you can configure this after saving.</p>
            ) : (
              <div className="mt-4">
                <button type="button" onClick={previewAudience} disabled={previewingAudience}
                  className="rounded-lg border border-navy/15 px-4 py-1.5 text-xs font-semibold text-navy hover:bg-cream-panel disabled:opacity-40">
                  {previewingAudience ? "Counting…" : "Preview audience size"}
                </button>
                {audiencePreview && (
                  <p className="mt-2 text-sm font-semibold text-green-700">
                    Estimated audience: {audiencePreview.count.toLocaleString()} contact{audiencePreview.count !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Step 5: Schedule ── */}
        {step === 5 && (
          <div className="rounded-2xl border border-navy/8 bg-white p-6">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-ink-soft">Schedule</h2>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Send time (optional)</label>
              <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
                className="rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
              <p className="mt-1 text-xs text-ink-soft">Leave blank to save as a draft and send manually from the campaign detail page.</p>
            </div>
            {scheduledAt && (
              <div className="mt-4 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
                Scheduled for {new Date(scheduledAt).toLocaleString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </div>
            )}
          </div>
        )}

        {/* ── Step 6: Review & Launch ── */}
        {step === 6 && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-navy/8 bg-white p-6">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-ink-soft">Campaign summary</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex gap-3"><dt className="w-28 shrink-0 font-semibold text-ink">Channel</dt><dd className="text-ink-soft">{channelType === "PUSH" ? "Browser notification" : "Email"}</dd></div>
                <div className="flex gap-3"><dt className="w-28 shrink-0 font-semibold text-ink">Name</dt><dd className="text-ink-soft">{name}</dd></div>
                <div className="flex gap-3"><dt className="w-28 shrink-0 font-semibold text-ink">Subject</dt><dd className="text-ink-soft">{subject}</dd></div>
                {isEmailCampaign && (
                  <div className="flex gap-3"><dt className="w-28 shrink-0 font-semibold text-ink">From</dt><dd className="text-ink-soft">{fromName} &lt;{fromEmail}&gt;</dd></div>
                )}
                {isEmailCampaign && (utmSource || utmMedium || utmCampaign) && (
                  <div className="flex gap-3"><dt className="w-28 shrink-0 font-semibold text-ink">UTM</dt>
                    <dd className="text-ink-soft font-mono text-xs">{[utmSource, utmMedium, utmCampaign].filter(Boolean).join(" / ")}</dd>
                  </div>
                )}
                <div className="flex gap-3">
                  <dt className="w-28 shrink-0 font-semibold text-ink">Audience</dt>
                  <dd className="text-ink-soft">
                    {audienceRules.include.length > 0
                      ? `${audienceRules.include.length} include rule${audienceRules.include.length !== 1 ? "s" : ""}${audienceRules.exclude.length > 0 ? ` + ${audienceRules.exclude.length} exclusion${audienceRules.exclude.length !== 1 ? "s" : ""}` : ""}${audiencePreview ? ` (~${audiencePreview.count.toLocaleString()} contacts)` : ""}`
                      : "Not defined — configure after saving"}
                  </dd>
                </div>
                <div className="flex gap-3">
                  <dt className="w-28 shrink-0 font-semibold text-ink">Schedule</dt>
                  <dd className="text-ink-soft">{scheduledAt ? new Date(scheduledAt).toLocaleString() : "Manual send (save as draft)"}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-6 flex gap-3">
          {step > 0 && (
            <button type="button" onClick={() => setStep(s => s - 1)}
              className="rounded-xl border border-navy/15 px-5 py-2.5 text-sm font-bold text-ink-soft hover:bg-cream-panel">
              Back
            </button>
          )}

          {step < STEPS.length - 1 ? (
            <button type="button" disabled={!canAdvance()} onClick={() => setStep(s => s + 1)}
              className="rounded-xl bg-navy px-5 py-2.5 text-sm font-bold text-white hover:bg-navy-dark disabled:opacity-40">
              Next: {STEPS[step + 1]}
            </button>
          ) : (
            <button type="button" disabled={saving || !canAdvance()} onClick={handleSubmit}
              className="rounded-xl bg-navy px-5 py-2.5 text-sm font-bold text-white hover:bg-navy-dark disabled:opacity-60">
              {saving ? "Saving…" : scheduledAt ? "Save and schedule" : "Save as draft"}
            </button>
          )}

          <a href="/admin/campaigns" className="rounded-xl border border-navy/15 px-5 py-2.5 text-sm font-bold text-ink-soft hover:bg-cream-panel no-underline">
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
  if (!session?.user?.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
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

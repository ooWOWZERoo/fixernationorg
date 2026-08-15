import { useState } from "react";
import Link from "next/link";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

interface TemplateData {
  key: string;
  description: string;
  subject: string;
  body: string;
  variables: string[];
  updatedBy: string | null;
  updatedAt: string;
}

interface Props {
  template: TemplateData;
}

const KEY_LABELS: Record<string, string> = {
  "application.submitted":              "Submission confirmation",
  "application.under_review":           "Under review",
  "application.info_required":          "Additional info requested",
  "application.conditionally_accepted": "Conditional acceptance",
  "application.accepted":               "Accepted — onboarding",
  "application.declined":               "Declined / rejected",
  "application.expired":                "Application expired",
  "application.withdrawn":              "Application withdrawn",
  "application.expiration_reminder":    "Expiration reminder",
  "activation.welcome":                 "Activation welcome",
};

const EditTemplatePage: NextPageWithLayout<Props> = ({ template }) => {
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const save = async () => {
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/message-templates/${template.key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ ok: true, message: "Template saved." });
      } else {
        setResult({ ok: false, message: data.error ?? "Save failed." });
      }
    } catch {
      setResult({ ok: false, message: "Network error." });
    } finally {
      setSaving(false);
    }
  };

  const sampleVars: Record<string, string> = {
    first_name:         "Alex",
    role:               "service provider",
    info_request_notes: "Please provide your current license number and expiration date.",
    review_notes:       "Territory assignment is pending. We'll reach out within 2 business days.",
    deadline:           "in 7 days",
  };

  const preview = body.replace(/\{\{(\w+)\}\}/g, (_, k) => sampleVars[k] ?? `{{${k}}}`);
  const subjectPreview = subject.replace(/\{\{(\w+)\}\}/g, (_, k) => sampleVars[k] ?? `{{${k}}}`);

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin/message-templates" className="text-sm text-slate-400 no-underline hover:text-navy">
          ← Email templates
        </Link>
        <span className="text-slate-300">/</span>
        <h1 className="text-xl font-bold text-slate-900">
          {KEY_LABELS[template.key] ?? template.key}
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Editor */}
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="mb-4 text-xs text-slate-400 font-mono">{template.key}</p>
            <p className="mb-4 text-sm text-slate-600">{template.description}</p>

            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Subject line
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
              />
            </div>

            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Body
              </label>
              <p className="mb-2 text-xs text-slate-400">
                Plain text. Blank lines between paragraphs. Use {"{{"} variable {"}}"}  placeholders.
              </p>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={16}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-mono text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
              />
            </div>

            {template.variables.length > 0 && (
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Available variables
                </p>
                <div className="flex flex-wrap gap-2">
                  {template.variables.map((v) => (
                    <code
                      key={v}
                      className="rounded bg-white border border-slate-200 px-2 py-0.5 text-xs text-navy font-mono"
                    >
                      {`{{${v}}}`}
                    </code>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={save}
                disabled={saving}
                className="rounded-lg bg-navy px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy-dark disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save template"}
              </button>
              {result && (
                <p className={`text-sm ${result.ok ? "text-green-600" : "text-red-500"}`}>
                  {result.message}
                </p>
              )}
            </div>
          </div>

          {template.updatedBy && (
            <p className="text-xs text-slate-400">
              Last edited {new Date(template.updatedAt).toLocaleDateString()} by {template.updatedBy}
            </p>
          )}
        </div>

        {/* Preview */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Preview (sample values)
          </p>
          <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2">
            <span className="text-xs text-slate-400">Subject: </span>
            <span className="text-sm text-slate-800">{subjectPreview}</span>
          </div>
          <div className="whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
            {preview}
          </div>
        </div>
      </div>
    </div>
  );
};

EditTemplatePage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return { redirect: { destination: `/signin?callbackUrl=${encodeURIComponent(context.resolvedUrl)}`, permanent: false } };
  }

  const key = context.params?.key as string;

  const template = await db.messageTemplate.findUnique({ where: { key } });
  if (!template) {
    return { notFound: true };
  }

  return {
    props: {
      template: JSON.parse(JSON.stringify(template)),
    },
  };
};

export default EditTemplatePage;

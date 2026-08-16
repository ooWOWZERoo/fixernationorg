import Link from "next/link";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

interface TemplateRow {
  key: string;
  description: string;
  subject: string;
  updatedBy: string | null;
  updatedAt: string;
}

interface Props {
  templates: TemplateRow[];
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
  "application.expiration_reminder":    "Expiration reminder (14 / 7 day)",
  "activation.welcome":                 "Activation welcome",
};

const ORDERED_KEYS = Object.keys(KEY_LABELS);

const MessageTemplatesPage: NextPageWithLayout<Props> = ({ templates }) => {
  const byKey = Object.fromEntries(templates.map((t) => [t.key, t]));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Email Templates</h1>
        <p className="mt-1 text-sm text-slate-500">
          Transactional emails sent during the application lifecycle. Edit subject and body
          text here; changes take effect on the next send.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100">
          <thead>
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                Template
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 hidden sm:table-cell">
                Subject line
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 hidden md:table-cell">
                Last edited
              </th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {ORDERED_KEYS.map((key) => {
              const row = byKey[key];
              return (
                <tr key={key} className="hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <p className="text-sm font-medium text-slate-900">
                      {KEY_LABELS[key] ?? key}
                    </p>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{key}</p>
                  </td>
                  <td className="px-5 py-4 hidden sm:table-cell">
                    <p className="text-sm text-slate-600 truncate max-w-xs">
                      {row?.subject ?? <span className="text-amber-500">Not seeded</span>}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-400 hidden md:table-cell">
                    {row?.updatedBy
                      ? <>
                          {new Date(row.updatedAt).toLocaleDateString()}{" "}
                          <span className="text-slate-300">by {row.updatedBy}</span>
                        </>
                      : <span className="text-slate-300">Default</span>
                    }
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/admin/message-templates/${key}`}
                      className="text-xs font-semibold text-navy no-underline hover:text-navy-dark"
                    >
                      Edit →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Templates use <code className="rounded bg-slate-100 px-1">{"{{variable}}"}</code> placeholders.
        Available variables are shown on each template&apos;s edit page.
      </p>
    </div>
  );
};

MessageTemplatesPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return { redirect: { destination: `/signin?callbackUrl=${encodeURIComponent(context.resolvedUrl)}`, permanent: false } };
  }

  const templates = await db.messageTemplate.findMany({
    select: { key: true, description: true, subject: true, updatedBy: true, updatedAt: true },
  });

  return {
    props: {
      templates: JSON.parse(JSON.stringify(templates)),
    },
  };
};

export default MessageTemplatesPage;

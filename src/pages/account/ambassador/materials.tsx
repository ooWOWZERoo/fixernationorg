import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

interface Material {
  id: string;
  name: string;
  subject: string;
  channelType: string;
  htmlBody: string | null;
  textBody: string | null;
  pushUrl: string | null;
  sentAt: string | null;
}

interface Props {
  materials: Material[];
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={handleCopy}
      className="rounded-lg border border-navy/15 bg-white px-3 py-1.5 text-xs font-semibold text-navy transition hover:bg-navy/5"
    >
      {copied ? "Copied" : label}
    </button>
  );
}

const AmbassadorMaterialsPage: NextPageWithLayout<Props> = ({ materials }) => {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <>
      <Head>
        <title>Campaign Materials — Fixer Nation</title>
      </Head>

      <section className="px-6 py-14 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-2 flex items-center gap-3 flex-wrap">
            <Link href="/dashboard" className="text-sm font-semibold text-ink-soft no-underline hover:text-navy">
              ← Dashboard
            </Link>
            <span className="text-ink-soft/40">·</span>
            <Link href="/account/ambassador" className="text-sm font-semibold text-ink-soft no-underline hover:text-navy">
              Ambassador profile
            </Link>
          </div>

          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-navy">Campaign materials</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Ready-to-use content from Fixer Nation. Copy the subject line and email body to use in your own outreach — don't send on behalf of FN directly.
          </p>

          {materials.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-navy/10 bg-white p-8 text-center">
              <p className="text-sm text-ink-soft">No campaign materials are available yet. Check back soon.</p>
            </div>
          ) : (
            <div className="mt-8 space-y-4">
              {materials.map((m) => {
                const isOpen = expanded === m.id;
                const date = m.sentAt
                  ? new Date(m.sentAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                  : null;

                return (
                  <div key={m.id} className="rounded-2xl border border-navy/10 bg-white overflow-hidden">
                    <div className="flex items-start justify-between gap-4 p-5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${m.channelType === "PUSH" ? "bg-violet-100 text-violet-700" : "bg-navy/8 text-navy"}`}>
                            {m.channelType === "PUSH" ? "Push" : "Email"}
                          </span>
                          {date && <span className="text-xs text-ink-soft">{date}</span>}
                        </div>
                        <p className="mt-2 text-sm font-bold text-navy">{m.name}</p>
                        <p className="mt-0.5 text-sm text-ink-soft truncate">{m.subject}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <CopyButton value={m.subject} label="Copy subject" />
                        <button
                          onClick={() => setExpanded(isOpen ? null : m.id)}
                          className="rounded-lg border border-navy/15 bg-white px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:text-navy"
                        >
                          {isOpen ? "Hide" : "Preview"}
                        </button>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="border-t border-navy/8 px-5 pb-5 pt-4 space-y-4">
                        {m.textBody && (
                          <div>
                            <div className="mb-2 flex items-center justify-between">
                              <p className="text-xs font-bold uppercase tracking-widest text-ink-soft">Plain text</p>
                              <CopyButton value={m.textBody} label="Copy text" />
                            </div>
                            <pre className="rounded-xl border border-navy/8 bg-cream-panel p-4 text-xs text-ink whitespace-pre-wrap max-h-48 overflow-auto">
                              {m.textBody}
                            </pre>
                          </div>
                        )}

                        {m.htmlBody && m.channelType !== "PUSH" && (
                          <div>
                            <div className="mb-2 flex items-center justify-between">
                              <p className="text-xs font-bold uppercase tracking-widest text-ink-soft">HTML</p>
                              <CopyButton value={m.htmlBody} label="Copy HTML" />
                            </div>
                            <div className="overflow-auto rounded-xl border border-navy/8 bg-cream-panel p-4 max-h-64">
                              <pre className="text-xs text-ink-soft whitespace-pre-wrap font-mono">
                                {m.htmlBody.slice(0, 3000)}{m.htmlBody.length > 3000 ? "\n…" : ""}
                              </pre>
                            </div>
                          </div>
                        )}

                        {m.channelType === "PUSH" && m.pushUrl && (
                          <div>
                            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-ink-soft">Click URL</p>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 truncate rounded-lg border border-navy/8 bg-cream-panel px-3 py-2 text-xs font-mono text-navy">
                                {m.pushUrl}
                              </code>
                              <CopyButton value={m.pushUrl} label="Copy URL" />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </>
  );
};

AmbassadorMaterialsPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;
export default AmbassadorMaterialsPage;

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.id) {
    return { redirect: { destination: "/signin?callbackUrl=/account/ambassador/materials", permanent: false } };
  }
  const allowed = ["AMBASSADOR", "ADMIN", "SUPER_ADMIN"];
  if (!allowed.includes(session.user.role)) {
    return { redirect: { destination: "/dashboard", permanent: false } };
  }

  const campaigns = await db.campaign.findMany({
    where: { isAmbassadorMaterial: true, status: "SENT" } as never,
    select: {
      id: true,
      name: true,
      subject: true,
      channelType: true,
      htmlBody: true,
      textBody: true,
      pushUrl: true,
      sentAt: true,
    } as never,
    orderBy: { sentAt: "desc" },
  });

  return {
    props: {
      materials: JSON.parse(JSON.stringify(campaigns)),
    },
  };
};

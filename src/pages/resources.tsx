import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { isMember } from "@/lib/access";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

interface ResourceSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  type: string | null;
  imageUrl: string | null;
  fileUrl: string | null;
  publishedAt: string;
}

interface Props {
  resources: ResourceSummary[];
  userIsMember: boolean;
}

const ResourcesPage: NextPageWithLayout<Props> = ({ resources, userIsMember }) => {
  const types = Array.from(new Set(resources.map((r) => r.type).filter(Boolean) as string[]));
  const [activeType, setActiveType] = useState("all");

  const visible = activeType === "all" ? resources : resources.filter((r) => r.type === activeType);

  return (
    <>
      <Head>
        <title>Resources — Fixer Nation</title>
        <meta name="description" content="Member-only guides, worksheets, tools, and templates from Fixer Nation." />
      </Head>

      {/* Header */}
      <section className="px-6 pb-4 pt-16 text-center lg:px-8">
        <div className="mx-auto max-w-2xl">
          <span className="eyebrow">Member Library</span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-navy lg:text-5xl">
            Resources
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            Member-only guides, worksheets, tools, and templates — the practical side of what you're learning here.
          </p>
        </div>
      </section>

      <section className="px-6 pb-20 pt-10 lg:px-8">
        <div className="mx-auto max-w-6xl">

          {/* Non-member gate */}
          {!userIsMember && (
            <>
              {/* Blurred preview grid */}
              {resources.length > 0 && (
                <div className="relative mb-6 overflow-hidden rounded-2xl">
                  <div className="pointer-events-none grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 select-none">
                    {resources.slice(0, 3).map((r) => (
                      <div key={r.id} className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0_16px_34px_-22px_rgba(20,40,56,0.25)]">
                        <div className="aspect-video overflow-hidden bg-cream-panel">
                          {r.imageUrl && (
                            <Image src={r.imageUrl} alt={r.title} width={480} height={270} className="h-full w-full object-cover blur-sm" />
                          )}
                        </div>
                        <div className="flex flex-1 flex-col p-5">
                          {r.type && <span className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-amber-dark">{r.type}</span>}
                          <h3 className="mb-2 text-[17px] font-extrabold leading-snug text-navy">{r.title}</h3>
                          {r.excerpt && <p className="flex-1 text-sm leading-relaxed text-ink-soft">{r.excerpt}</p>}
                          <div className="mt-5 inline-flex items-center gap-1.5 rounded-[8px] border-2 border-navy/20 bg-navy/5 px-4 py-2 text-xs font-bold text-navy/50">
                            🔒 Members only
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-cream via-cream/80 to-transparent" />
                </div>
              )}

              {/* Gate CTA */}
              <div className="rounded-2xl border border-navy/10 bg-white p-10 text-center shadow-[0_16px_34px_-22px_rgba(20,40,56,0.25)]">
                <p className="text-xs font-extrabold uppercase tracking-widest text-ink-soft">Members only</p>
                <h2 className="mt-3 text-2xl font-extrabold text-navy">Full access is for members</h2>
                <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
                  Join Fixer Nation to get every guide, worksheet, and downloadable tool in the library.
                </p>
                <Link
                  href="/join"
                  className="mt-6 inline-flex items-center justify-center rounded-[10px] bg-amber px-8 py-3.5 text-sm font-bold text-navy-dark no-underline shadow-[0_12px_24px_-10px_rgba(242,169,60,0.65)] transition-all hover:-translate-y-0.5 hover:bg-amber-dark"
                >
                  Join Fixer Nation
                </Link>
              </div>
            </>
          )}

          {/* Member view */}
          {userIsMember && (
            <>
              {resources.length === 0 && (
                <div className="rounded-2xl bg-white p-14 text-center shadow-[0_16px_34px_-22px_rgba(20,40,56,0.25)]">
                  <p className="text-lg font-bold text-navy">Resources coming soon.</p>
                  <p className="mt-2 text-sm text-ink-soft">The first guides and worksheets are on their way.</p>
                </div>
              )}

              {resources.length > 0 && (
                <>
                  {/* Type filter chips */}
                  {types.length > 0 && (
                    <div className="mb-9 flex flex-wrap justify-center gap-3">
                      <button
                        onClick={() => setActiveType("all")}
                        className={["rounded-full px-5 py-2.5 text-sm font-bold transition-colors", activeType === "all" ? "bg-navy text-white" : "bg-white text-ink-soft shadow-[0_6px_16px_-10px_rgba(20,40,56,0.25)] hover:text-navy"].join(" ")}
                      >
                        All
                      </button>
                      {types.map((t) => (
                        <button
                          key={t}
                          onClick={() => setActiveType(t)}
                          className={["rounded-full px-5 py-2.5 text-sm font-bold transition-colors", activeType === t ? "bg-navy text-white" : "bg-white text-ink-soft shadow-[0_6px_16px_-10px_rgba(20,40,56,0.25)] hover:text-navy"].join(" ")}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {visible.map((r) => (
                      <div key={r.id} className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0_16px_34px_-22px_rgba(20,40,56,0.25)] transition-transform hover:-translate-y-1.5">
                        <div className="aspect-video overflow-hidden bg-cream-panel">
                          {r.imageUrl && (
                            <Image src={r.imageUrl} alt={r.title} width={480} height={270} className="h-full w-full object-cover" />
                          )}
                        </div>
                        <div className="flex flex-1 flex-col p-5">
                          {r.type && (
                            <span className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-amber-dark">{r.type}</span>
                          )}
                          <h3 className="mb-2 text-[17px] font-extrabold leading-snug text-navy">{r.title}</h3>
                          {r.excerpt && (
                            <p className="flex-1 text-sm leading-relaxed text-ink-soft">{r.excerpt}</p>
                          )}
                          <div className="mt-5 flex flex-wrap gap-2">
                            <Link
                              href={`/resources/${r.slug}`}
                              className="inline-flex items-center rounded-[8px] border-2 border-navy px-4 py-2 text-xs font-bold text-navy no-underline transition-all hover:bg-navy hover:text-white"
                            >
                              Read More
                            </Link>
                            {r.fileUrl && (
                              <a
                                href={r.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center rounded-[8px] bg-amber/15 px-4 py-2 text-xs font-bold text-navy-dark no-underline hover:bg-amber/30"
                              >
                                Download
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
};

ResourcesPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  const userIsMember = session ? isMember(session.user.role, session.user.adminRole) : false;

  const all = await db.resource.findMany({
    where: { publishedAt: { not: null } },
    select: { id: true, slug: true, title: true, excerpt: true, type: true, imageUrl: true, fileUrl: true, publishedAt: true },
    orderBy: { publishedAt: "desc" },
  });

  return { props: { resources: JSON.parse(JSON.stringify(all)), userIsMember } };
};

export default ResourcesPage;

import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { isMember } from "@/lib/access";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

interface BoostSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  imageUrl: string | null;
  authorName: string;
  publishedAt: string;
}

interface Props {
  featured: BoostSummary | null;
  archive: BoostSummary[];
  isActiveMember: boolean;
}

const MorningBoostPage: NextPageWithLayout<Props> = ({ featured, archive, isActiveMember }) => {
  const hasArchive = archive.length > 0;

  return (
    <>
      <Head>
        <title>Morning Boost — Fixer Nation</title>
        <meta
          name="description"
          content="Daily inspiration from Fixer Nation. One short read every morning to help you reset, refocus, and move forward."
        />
      </Head>

      {/* Hero */}
      <section className="px-6 pb-4 pt-16 text-center lg:px-8">
        <div className="mx-auto max-w-2xl">
          <span className="eyebrow">Daily Inspiration</span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-navy lg:text-5xl">
            Morning Boost
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            A short read every morning to help you reset, refocus, and move forward.
          </p>
        </div>
      </section>

      <section className="px-6 pb-20 pt-10 lg:px-8">
        <div className="mx-auto max-w-3xl">

          {/* No content yet */}
          {!featured && (
            <div className="rounded-2xl bg-white p-14 text-center shadow-[0_16px_34px_-22px_rgba(20,40,56,0.25)]">
              <p className="text-lg font-bold text-navy">First boost coming soon.</p>
              <p className="mt-2 text-sm text-ink-soft">
                Check back tomorrow morning.
              </p>
            </div>
          )}

          {/* Featured entry — visible to everyone */}
          {featured && (
            <article className="mb-12 overflow-hidden rounded-2xl bg-white shadow-[0_20px_45px_-20px_rgba(20,40,56,0.3)]">
              {featured.imageUrl && (
                <div className="aspect-[2/1] overflow-hidden">
                  <Image
                    src={featured.imageUrl}
                    alt={featured.title}
                    width={800}
                    height={400}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <div className="p-8 lg:p-10">
                <span className="eyebrow">Today's boost</span>
                <h2 className="mt-4 text-2xl font-extrabold leading-snug text-navy lg:text-3xl">
                  {featured.title}
                </h2>
                {featured.excerpt && (
                  <p className="mt-3 text-base leading-relaxed text-ink-soft">{featured.excerpt}</p>
                )}
                <div className="mt-6 flex items-center justify-between gap-4">
                  <p className="text-xs font-bold text-ink-soft">{featured.authorName}</p>
                  <Link
                    href={`/morning-boost/${featured.slug}`}
                    className="inline-flex items-center rounded-[10px] bg-amber px-6 py-3 text-sm font-bold text-navy-dark no-underline shadow-[0_12px_24px_-10px_rgba(242,169,60,0.65)] transition-all hover:-translate-y-0.5 hover:bg-amber-dark"
                  >
                    Read Today's Boost
                  </Link>
                </div>
              </div>
            </article>
          )}

          {/* Archive */}
          {hasArchive && (
            <>
              <h2 className="mb-6 text-xl font-extrabold text-navy">Past boosts</h2>

              {isActiveMember ? (
                <div className="space-y-4">
                  {archive.map((entry) => (
                    <Link
                      key={entry.id}
                      href={`/morning-boost/${entry.slug}`}
                      className="flex items-center gap-5 rounded-2xl bg-white p-5 no-underline shadow-[0_10px_24px_-18px_rgba(20,40,56,0.25)] transition-transform hover:-translate-y-0.5"
                    >
                      {entry.imageUrl && (
                        <Image
                          src={entry.imageUrl}
                          alt={entry.title}
                          width={72}
                          height={72}
                          className="h-18 w-18 shrink-0 rounded-xl object-cover"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="font-bold text-navy line-clamp-1">{entry.title}</p>
                        {entry.excerpt && (
                          <p className="mt-1 text-sm text-ink-soft line-clamp-2">{entry.excerpt}</p>
                        )}
                        <p className="mt-1 text-xs text-ink-soft">
                          {new Date(entry.publishedAt).toLocaleDateString("en-US", {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                /* Gate for non-members */
                <div className="relative">
                  {/* Blurred preview — first 3 entries */}
                  <div className="pointer-events-none select-none space-y-4 blur-sm">
                    {archive.slice(0, 3).map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center gap-5 rounded-2xl bg-white p-5 shadow-[0_10px_24px_-18px_rgba(20,40,56,0.25)]"
                      >
                        <div className="h-[72px] w-[72px] shrink-0 rounded-xl bg-cream-panel" />
                        <div className="min-w-0">
                          <p className="font-bold text-navy line-clamp-1">{entry.title}</p>
                          {entry.excerpt && (
                            <p className="mt-1 text-sm text-ink-soft line-clamp-2">{entry.excerpt}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Gate overlay */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-gradient-to-t from-cream via-cream/90 to-transparent px-8 pt-16 text-center">
                    <p className="text-lg font-extrabold text-navy">Members get the full archive.</p>
                    <p className="mt-2 text-sm text-ink-soft">
                      Every past Morning Boost is waiting for you.
                    </p>
                    <Link
                      href="/join"
                      className="mt-5 inline-flex items-center rounded-[10px] bg-amber px-7 py-3 text-sm font-bold text-navy-dark no-underline shadow-[0_12px_24px_-10px_rgba(242,169,60,0.65)] transition-all hover:-translate-y-0.5 hover:bg-amber-dark"
                    >
                      Join Fixer Nation
                    </Link>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* CTA band — only shown to non-members */}
      {!isActiveMember && (
        <section className="bg-navy px-6 py-20 text-center lg:px-8">
          <div className="mx-auto max-w-xl">
            <span
              className="eyebrow"
              style={{ background: "rgba(255,255,255,0.12)", color: "#F2D9AE" }}
            >
              Membership
            </span>
            <h2 className="mt-4 text-3xl font-extrabold text-white">
              Morning Boost is included with every membership
            </h2>
            <Link
              href="/join"
              className="mt-7 inline-flex items-center justify-center rounded-[10px] bg-amber px-8 py-3.5 text-sm font-bold text-navy-dark no-underline shadow-[0_12px_24px_-10px_rgba(242,169,60,0.65)] transition-all hover:-translate-y-0.5 hover:bg-amber-dark"
            >
              Join Fixer Nation
            </Link>
          </div>
        </section>
      )}
    </>
  );
};

MorningBoostPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  const activeMember = session ? isMember(session.user.role) : false;

  const all = await db.morningBoost.findMany({
    where: { publishedAt: { not: null } },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      imageUrl: true,
      authorName: true,
      publishedAt: true,
    },
    orderBy: { publishedAt: "desc" },
  });

  const serialized: BoostSummary[] = JSON.parse(JSON.stringify(all));
  const featured = serialized[0] ?? null;
  const archive = serialized.slice(1);

  return {
    props: { featured, archive, isActiveMember: activeMember },
  };
};

export default MorningBoostPage;

import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { db } from "@/lib/db";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

type AmbassadorCard = {
  id: string;
  name: string | null;
  username: string;
  headline: string | null;
  location: string | null;
  avatarUrl: string | null;
  territory: string | null;
  bio: string | null;
};

interface Props {
  ambassadors: AmbassadorCard[];
}

const AmbassadorsPage: NextPageWithLayout<Props> = ({ ambassadors }) => {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? ambassadors.filter((a) => {
        const q = query.toLowerCase();
        return (
          a.name?.toLowerCase().includes(q) ||
          a.territory?.toLowerCase().includes(q) ||
          a.headline?.toLowerCase().includes(q) ||
          a.location?.toLowerCase().includes(q)
        );
      })
    : ambassadors;

  return (
    <>
      <Head>
        <title>Find an Ambassador — Fixer Nation</title>
        <meta name="description" content="Meet the Fixer Nation brand ambassadors in your area." />
      </Head>
      <main className="mx-auto max-w-5xl px-6 py-12 lg:px-8">
        <div className="mb-8">
          <p className="mb-2 text-sm font-bold uppercase tracking-widest text-amber-dark">
            Brand Ambassadors
          </p>
          <h1 className="mb-3 text-3xl font-extrabold text-navy">Find an Ambassador</h1>
          <p className="max-w-xl text-muted">
            Ambassadors are members who represent Fixer Nation in their communities. They applied, got reviewed, and said yes to helping others find us.
          </p>
        </div>

        <div className="mb-6">
          <input
            type="search"
            placeholder="Search by name or area..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full max-w-sm rounded-xl border border-navy/12 px-4 py-2.5 text-sm text-ink placeholder-muted focus:border-navy/30 focus:outline-none"
          />
        </div>

        <div className="mb-8 flex items-center justify-between gap-4 rounded-2xl border border-amber/30 bg-amber/8 px-5 py-4">
          <p className="text-sm text-ink">
            Want to represent Fixer Nation in your area? We&apos;d love to hear from you.
          </p>
          <Link
            href="/become-an-ambassador"
            className="shrink-0 rounded-lg bg-amber px-4 py-2 text-sm font-bold text-navy-dark no-underline hover:bg-amber-dark transition-colors"
          >
            Apply to join
          </Link>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted">
            {query ? "Nobody here matches that search." : "No ambassadors are listed yet."}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((a) => (
              <Link
                key={a.id}
                href={`/profile/${a.username}`}
                className="group rounded-2xl border border-navy/8 bg-white p-5 shadow-sm no-underline transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  <div className="shrink-0">
                    {a.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.avatarUrl}
                        alt={a.name ?? "Ambassador"}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-navy text-base font-bold text-amber">
                        {a.name?.[0]?.toUpperCase() ?? "A"}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-navy group-hover:text-amber-dark">
                      {a.name ?? a.username}
                    </p>
                    {a.territory ? (
                      <p className="mt-0.5 text-sm font-medium text-amber-dark truncate">{a.territory}</p>
                    ) : a.headline ? (
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted">{a.headline}</p>
                    ) : null}
                    {(a.location) && (
                      <p className="mt-2 flex items-center gap-1 text-xs text-muted">
                        <svg className="h-3 w-3 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                        </svg>
                        {a.location}
                      </p>
                    )}
                  </div>
                </div>
                <p className="mt-4 text-xs font-semibold text-amber-dark group-hover:underline">
                  View profile →
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
};

AmbassadorsPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;
export default AmbassadorsPage;

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  const users = await db.user.findMany({
    where: {
      role: "AMBASSADOR",
      username: { not: null },
    },
    include: {
      socialProfile: {
        select: { headline: true, location: true, avatarUrl: true },
      },
      ambassadorProfile: {
        select: { territory: true, bio: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const ambassadors: AmbassadorCard[] = users
    .filter((u) => u.username !== null)
    .map((u) => ({
      id: u.id,
      name: u.name,
      username: u.username!,
      headline: u.socialProfile?.headline ?? null,
      location: u.socialProfile?.location ?? null,
      avatarUrl: u.socialProfile?.avatarUrl ?? null,
      territory: u.ambassadorProfile?.territory ?? null,
      bio: u.ambassadorProfile?.bio ?? null,
    }));

  return { props: { ambassadors } };
};

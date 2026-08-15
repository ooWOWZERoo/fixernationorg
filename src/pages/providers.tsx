import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { db } from "@/lib/db";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

type ProviderCard = {
  applicationId: string;
  username: string | null;
  name: string | null;
  avatarUrl: string | null;
  businessName: string | null;
  serviceCategory: string | null;
  serviceAreas: string[];
  location: string | null;
  directoryListedAt: string | null;
};

interface Props {
  providers: ProviderCard[];
}

const ProvidersPage: NextPageWithLayout<Props> = ({ providers }) => {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? providers.filter((p) => {
        const q = query.toLowerCase();
        return (
          p.name?.toLowerCase().includes(q) ||
          p.businessName?.toLowerCase().includes(q) ||
          p.serviceCategory?.toLowerCase().includes(q) ||
          p.location?.toLowerCase().includes(q) ||
          p.serviceAreas.some((a) => a.toLowerCase().includes(q))
        );
      })
    : providers;

  return (
    <>
      <Head>
        <title>Find a Provider — Fixer Nation</title>
        <meta
          name="description"
          content="Browse vetted service providers in the Fixer Nation community."
        />
      </Head>
      <main className="mx-auto max-w-5xl px-6 py-12 lg:px-8">
        <div className="mb-8">
          <p className="mb-2 text-sm font-bold uppercase tracking-widest text-amber-dark">
            Service Providers
          </p>
          <h1 className="mb-3 text-3xl font-extrabold text-navy">Find a Provider</h1>
          <p className="max-w-xl text-muted">
            These are professionals who applied to join, went through our review, and got in.
            Search by name, specialty, or location.
          </p>
        </div>

        <div className="mb-6">
          <input
            type="search"
            placeholder="Search by name, specialty, or location…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full max-w-sm rounded-xl border border-navy/12 px-4 py-2.5 text-sm text-ink placeholder-muted focus:border-navy/30 focus:outline-none"
          />
        </div>

        <div className="mb-8 flex items-center justify-between gap-4 rounded-2xl border border-amber/30 bg-amber/8 px-5 py-4">
          <p className="text-sm text-ink">
            Are you a service professional? Join our verified provider network and get in front of members who are looking for help.
          </p>
          <Link
            href="/become-a-provider"
            className="shrink-0 rounded-lg bg-amber px-4 py-2 text-sm font-bold text-navy-dark no-underline hover:bg-amber-dark transition-colors"
          >
            Apply to join
          </Link>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted">
            {query ? "Nobody here matches that search." : "No providers are listed yet."}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => {
              const href = p.username ? `/profile/${p.username}` : null;
              const card = (
                <div className="group rounded-2xl border border-navy/8 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md h-full flex flex-col">
                  <div className="flex items-start gap-4">
                    <div className="shrink-0">
                      {p.avatarUrl ? (
                        <img
                          src={p.avatarUrl}
                          alt={p.name ?? "Provider"}
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-navy text-base font-bold text-amber">
                          {(p.businessName ?? p.name)?.[0]?.toUpperCase() ?? "P"}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-navy group-hover:text-amber-dark">
                        {p.businessName ?? p.name ?? "Provider"}
                      </p>
                      {p.serviceCategory && (
                        <p className="mt-0.5 text-sm font-medium text-amber-dark truncate">
                          {p.serviceCategory}
                        </p>
                      )}
                      {p.location && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                          <svg className="h-3 w-3 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                          </svg>
                          {p.location}
                        </p>
                      )}
                    </div>
                  </div>

                  {p.serviceAreas.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {p.serviceAreas.slice(0, 4).map((area) => (
                        <span
                          key={area}
                          className="inline-flex rounded-full bg-navy/6 px-2.5 py-0.5 text-xs font-medium text-navy"
                        >
                          {area}
                        </span>
                      ))}
                      {p.serviceAreas.length > 4 && (
                        <span className="inline-flex rounded-full bg-navy/6 px-2.5 py-0.5 text-xs font-medium text-navy">
                          +{p.serviceAreas.length - 4} more
                        </span>
                      )}
                    </div>
                  )}

                  {href && (
                    <p className="mt-auto pt-4 text-xs font-semibold text-amber-dark group-hover:underline">
                      View profile →
                    </p>
                  )}
                </div>
              );

              return href ? (
                <Link key={p.applicationId} href={href} className="no-underline">
                  {card}
                </Link>
              ) : (
                <div key={p.applicationId}>{card}</div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
};

ProvidersPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;
export default ProvidersPage;

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  const applications = await db.userApplication.findMany({
    where: {
      type: "PROVIDER",
      status: { in: ["ACTIVE", "APPROVED"] },
      directoryListed: true,
      userId: { not: null },
    },
    orderBy: { directoryListedAt: "asc" },
    select: {
      id: true,
      name: true,
      userId: true,
      directoryListedAt: true,
      providerDetail: {
        select: {
          businessName: true,
          serviceCategory: true,
          serviceAreas: true,
        },
      },
    },
  });

  const userIds = applications.map((a) => a.userId!);
  const users = userIds.length
    ? await db.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          username: true,
          socialProfile: { select: { avatarUrl: true, location: true } },
        },
      })
    : [];

  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const providers: ProviderCard[] = applications.map((a) => {
    const u = a.userId ? userMap[a.userId] : null;
    return {
      applicationId: a.id,
      username: u?.username ?? null,
      name: a.name,
      avatarUrl: u?.socialProfile?.avatarUrl ?? null,
      businessName: a.providerDetail?.businessName ?? null,
      serviceCategory: a.providerDetail?.serviceCategory ?? null,
      serviceAreas: a.providerDetail?.serviceAreas ?? [],
      location: u?.socialProfile?.location ?? null,
      directoryListedAt: a.directoryListedAt?.toISOString() ?? null,
    };
  });

  return { props: { providers } };
};

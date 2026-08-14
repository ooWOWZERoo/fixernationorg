import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { db } from "@/lib/db";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

type ProviderCard = {
  id: string;
  name: string | null;
  username: string;
  headline: string | null;
  location: string | null;
  avatarUrl: string | null;
  businessName: string | null;
  specialty: string | null;
  serviceArea: string | null;
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
          p.specialty?.toLowerCase().includes(q) ||
          p.headline?.toLowerCase().includes(q) ||
          p.serviceArea?.toLowerCase().includes(q) ||
          p.location?.toLowerCase().includes(q)
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
            These are people who applied to join, went through our review, and got in.
            Search by name or location, or just scroll through and see who&apos;s here.
          </p>
        </div>

        <div className="mb-8">
          <input
            type="search"
            placeholder="Search by name or location..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full max-w-sm rounded-xl border border-navy/12 px-4 py-2.5 text-sm text-ink placeholder-muted focus:border-navy/30 focus:outline-none"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted">
            {query ? "Nobody here matches that search." : "No providers are listed yet."}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <Link
                key={p.id}
                href={`/profile/${p.username}`}
                className="group rounded-2xl border border-navy/8 bg-white p-5 shadow-sm no-underline transition hover:-translate-y-0.5 hover:shadow-md"
              >
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
                        {p.name?.[0]?.toUpperCase() ?? "P"}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-navy group-hover:text-amber-dark">
                      {p.businessName ?? p.name ?? p.username}
                    </p>
                    {p.specialty ? (
                      <p className="mt-0.5 text-sm font-medium text-amber-dark truncate">{p.specialty}</p>
                    ) : p.headline ? (
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted">{p.headline}</p>
                    ) : null}
                    {(p.serviceArea ?? p.location) && (
                      <p className="mt-2 flex items-center gap-1 text-xs text-muted">
                        <svg
                          className="h-3 w-3 shrink-0"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {p.serviceArea ?? p.location}
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

ProvidersPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;
export default ProvidersPage;

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  const users = await db.user.findMany({
    where: {
      role: "PROVIDER",
      username: { not: null },
    },
    include: {
      socialProfile: {
        select: { headline: true, location: true, avatarUrl: true },
      },
      providerProfile: {
        select: { businessName: true, specialty: true, serviceArea: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const providers: ProviderCard[] = users
    .filter((u) => u.username !== null)
    .map((u) => ({
      id: u.id,
      name: u.name,
      username: u.username!,
      headline: u.socialProfile?.headline ?? null,
      location: u.socialProfile?.location ?? null,
      avatarUrl: u.socialProfile?.avatarUrl ?? null,
      businessName: u.providerProfile?.businessName ?? null,
      specialty: u.providerProfile?.specialty ?? null,
      serviceArea: u.providerProfile?.serviceArea ?? null,
    }));

  return { props: { providers } };
};

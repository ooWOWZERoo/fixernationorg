import Head from "next/head";
import Link from "next/link";
import { useState, useMemo } from "react";
import { GetServerSideProps } from "next";
import { db } from "@/lib/db";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

interface ProviderCard {
  username: string;
  name: string | null;
  avatarUrl: string | null;
  headline: string | null;
  location: string | null;
  specialty: string | null;
  serviceCategory: string | null;
  serviceAreas: string[];
  serviceArea: string | null;
  businessName: string | null;
}

interface Props {
  providers: ProviderCard[];
  categories: string[];
}

const ProvidersPage: NextPageWithLayout<Props> = ({ providers, categories }) => {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");

  const filtered = useMemo(() => {
    let list = providers;
    if (cat) {
      list = list.filter(
        (p) => (p.serviceCategory ?? p.specialty ?? "")
          .toLowerCase()
          .includes(cat.toLowerCase())
      );
    }
    if (q.trim()) {
      const term = q.trim().toLowerCase();
      list = list.filter(
        (p) =>
          (p.name ?? "").toLowerCase().includes(term) ||
          (p.businessName ?? "").toLowerCase().includes(term) ||
          (p.specialty ?? "").toLowerCase().includes(term) ||
          (p.serviceCategory ?? "").toLowerCase().includes(term) ||
          (p.location ?? "").toLowerCase().includes(term) ||
          p.serviceAreas.some((a) => a.toLowerCase().includes(term)) ||
          (p.serviceArea ?? "").toLowerCase().includes(term)
      );
    }
    return list;
  }, [providers, q, cat]);

  return (
    <>
      <Head>
        <title>Find a Service Provider — Fixer Nation</title>
        <meta
          name="description"
          content="Browse vetted service providers in the Fixer Nation network. Licensed professionals across financial services, legal, real estate, insurance, health, and more."
        />
      </Head>

      <section className="px-6 py-16 lg:px-8">
        <div className="mx-auto max-w-5xl">

          {/* Header */}
          <div className="mb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-dark mb-2">
              Provider directory
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight text-navy lg:text-5xl">
              Find a service provider
            </h1>
            <p className="mt-3 text-base text-ink-soft max-w-xl">
              Every provider here has been vetted and accepted into the Fixer Nation network.
              These are professionals members trust.
            </p>
          </div>

          {/* Filters */}
          <div className="mb-8 flex flex-col gap-3 sm:flex-row">
            <input
              type="search"
              placeholder="Search by name, specialty, or location…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="flex-1 rounded-xl border border-navy/15 bg-white px-4 py-2.5 text-sm text-ink placeholder-ink-soft/60 shadow-sm focus:border-navy/30 focus:outline-none focus:ring-2 focus:ring-navy/15"
            />
            {categories.length > 0 && (
              <select
                value={cat}
                onChange={(e) => setCat(e.target.value)}
                className="rounded-xl border border-navy/15 bg-white px-4 py-2.5 text-sm text-ink shadow-sm focus:border-navy/30 focus:outline-none focus:ring-2 focus:ring-navy/15 sm:w-56"
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
          </div>

          {/* Results count */}
          <p className="mb-5 text-xs font-semibold text-ink-soft">
            {filtered.length === providers.length
              ? `${providers.length} provider${providers.length !== 1 ? "s" : ""}`
              : `${filtered.length} of ${providers.length} providers`}
          </p>

          {/* Grid */}
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-navy/8 bg-white p-16 text-center">
              <p className="text-sm text-ink-soft">
                {q || cat ? "No providers match your search." : "No providers listed yet."}
              </p>
              {(q || cat) && (
                <button
                  onClick={() => { setQ(""); setCat(""); }}
                  className="mt-4 text-sm font-semibold text-navy hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p) => {
                const displayName = p.name ?? p.username;
                const initials = displayName[0].toUpperCase();
                const categoryLabel = p.serviceCategory ?? p.specialty;
                const areas = p.serviceAreas.length > 0
                  ? p.serviceAreas
                  : p.serviceArea
                  ? [p.serviceArea]
                  : [];

                return (
                  <Link
                    key={p.username}
                    href={`/profile/${p.username}`}
                    className="group flex flex-col rounded-2xl border border-navy/8 bg-white p-6 no-underline shadow-sm transition hover:border-navy/20 hover:shadow-md"
                  >
                    {/* Avatar + name */}
                    <div className="mb-4 flex items-center gap-3">
                      {p.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.avatarUrl}
                          alt={displayName}
                          className="h-12 w-12 flex-shrink-0 rounded-full object-cover ring-2 ring-navy/8"
                        />
                      ) : (
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-navy text-base font-bold text-amber">
                          {initials}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-extrabold text-navy group-hover:text-navy-dark">
                          {p.businessName ?? displayName}
                        </p>
                        {p.businessName && p.name && (
                          <p className="truncate text-xs text-ink-soft">{p.name}</p>
                        )}
                      </div>
                    </div>

                    {/* Category */}
                    {categoryLabel && (
                      <span className="mb-3 self-start rounded-full bg-amber/15 px-3 py-0.5 text-xs font-semibold text-amber-dark">
                        {categoryLabel}
                      </span>
                    )}

                    {/* Headline / bio snippet */}
                    {p.headline && (
                      <p className="mb-3 text-sm text-ink line-clamp-2">{p.headline}</p>
                    )}

                    {/* Location + service areas */}
                    <div className="mt-auto space-y-1 text-xs text-ink-soft">
                      {p.location && (
                        <p className="flex items-center gap-1">
                          <svg className="h-3 w-3 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                          </svg>
                          {p.location}
                        </p>
                      )}
                      {areas.length > 0 && (
                        <p className="truncate">
                          Serves: {areas.slice(0, 3).join(", ")}{areas.length > 3 ? ` +${areas.length - 3} more` : ""}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Bottom CTA for providers */}
          <div className="mt-16 rounded-2xl bg-navy px-8 py-10 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-amber mb-3">
              Are you a professional?
            </p>
            <h2 className="text-2xl font-extrabold text-white">
              Join the network
            </h2>
            <p className="mt-2 text-sm text-white/70 max-w-md mx-auto">
              Apply to become a Fixer Nation service provider. We review every application.
            </p>
            <Link
              href="/service-provider"
              className="mt-6 inline-block rounded-[10px] bg-amber px-7 py-3 text-sm font-bold text-navy-dark no-underline hover:bg-amber-dark transition-colors"
            >
              Learn more and apply
            </Link>
          </div>

        </div>
      </section>
    </>
  );
};

ProvidersPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;
export default ProvidersPage;

export const getServerSideProps: GetServerSideProps = async () => {
  const listedApplications = await db.userApplication.findMany({
    where: {
      directoryListed: true,
      type: "PROVIDER",
      status: "ACTIVE",
      userId: { not: null },
    },
    orderBy: { directoryListedAt: "desc" },
    select: {
      user: {
        select: {
          username: true,
          name: true,
          socialProfile: {
            select: { headline: true, location: true, avatarUrl: true },
          },
          providerProfile: {
            select: { specialty: true, serviceArea: true, businessName: true },
          },
        },
      },
      providerDetail: {
        select: {
          serviceCategory: true,
          serviceAreas: true,
          businessName: true,
        },
      },
    },
  });

  const providers: ProviderCard[] = listedApplications
    .filter((a) => a.user?.username)
    .map((a) => ({
      username: a.user!.username!,
      name: a.user!.name,
      avatarUrl: a.user!.socialProfile?.avatarUrl ?? null,
      headline: a.user!.socialProfile?.headline ?? null,
      location: a.user!.socialProfile?.location ?? null,
      specialty: a.user!.providerProfile?.specialty ?? null,
      serviceCategory: a.providerDetail?.serviceCategory ?? null,
      serviceAreas: a.providerDetail?.serviceAreas ?? [],
      serviceArea: a.user!.providerProfile?.serviceArea ?? null,
      businessName:
        a.providerDetail?.businessName ??
        a.user!.providerProfile?.businessName ??
        null,
    }));

  // Unique non-null categories for the filter dropdown
  const categoriesSet = new Set<string>();
  for (const p of providers) {
    const label = p.serviceCategory ?? p.specialty;
    if (label) categoriesSet.add(label);
  }
  const categories = Array.from(categoriesSet).sort();

  return { props: { providers, categories } };
};

import Head from "next/head";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

const PAGE_SIZE = 50;

const ATTR_COLORS: Record<string, string> = {
  ORGANIC: "bg-green-100 text-green-800",
  REFERRAL: "bg-blue-100 text-blue-800",
  IMPORT: "bg-navy/8 text-navy",
  MANUAL: "bg-navy/8 text-navy",
  INVITE: "bg-purple-100 text-purple-800",
  SUBSCRIBE_FORM: "bg-amber/20 text-amber-dark",
  CAMPAIGN: "bg-teal-100 text-teal-800",
};

const ATTRIBUTION_SOURCES = ["ORGANIC", "REFERRAL", "IMPORT", "MANUAL", "INVITE", "SUBSCRIBE_FORM", "CAMPAIGN"];

interface ContactRow {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  source: string | null;
  createdAt: string;
  tags: string[];
  listCount: number;
  attributionSource: string | null;
}

interface Props {
  contacts: ContactRow[];
  total: number;
  page: number;
  pageSize: number;
  q: string;
  attrFilter: string;
}

const AdminContactsPage: NextPageWithLayout<Props> = ({ contacts, total, page, pageSize, q: initialQ, attrFilter: initialAttr }) => {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setQ(initialQ); }, [initialQ]);

  function navigate(updates: { q?: string; attr?: string; page?: number }) {
    const current = {
      q: initialQ,
      attr: initialAttr,
      page: 1,
      ...updates,
    };
    const params = new URLSearchParams();
    if (current.q) params.set("q", current.q);
    if (current.attr) params.set("attr", current.attr);
    if (current.page > 1) params.set("page", String(current.page));
    const qs = params.toString();
    router.push(`/admin/contacts${qs ? `?${qs}` : ""}`, undefined, { shallow: false });
  }

  function handleSearchChange(val: string) {
    setQ(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navigate({ q: val, page: 1 }), 400);
  }

  function handleAttrChange(val: string) {
    navigate({ attr: val, page: 1 });
  }

  const totalPages = Math.ceil(total / pageSize);
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <>
      <Head><title>Contacts — Admin</title></Head>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-y-3">
        <div>
          <h1 className="text-2xl font-extrabold text-navy">Contacts</h1>
          <p className="mt-0.5 text-sm text-ink-soft">{total.toLocaleString()} total</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/admin/contacts/export`}
            download
            className="rounded-xl border border-navy/15 px-4 py-2 text-sm font-bold text-ink-soft no-underline hover:bg-cream-panel"
          >
            Export CSV
          </a>
          <Link
            href="/admin/contacts/import"
            className="rounded-xl border border-navy/15 px-4 py-2 text-sm font-bold text-ink-soft no-underline hover:bg-cream-panel"
          >
            Import CSV
          </Link>
          <Link
            href="/admin/contacts/new"
            className="rounded-xl bg-amber px-4 py-2 text-sm font-bold text-navy-dark no-underline hover:bg-amber-dark"
          >
            + Add contact
          </Link>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search by name, email, or company…"
          value={q}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full max-w-sm rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
        />
        <select
          value={initialAttr}
          onChange={(e) => handleAttrChange(e.target.value)}
          className="rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
        >
          <option value="">All attribution sources</option>
          {ATTRIBUTION_SOURCES.map((s) => (
            <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>

      {contacts.length === 0 ? (
        <div className="rounded-2xl border border-navy/8 bg-white p-12 text-center">
          <p className="text-sm text-ink-soft">{initialQ || initialAttr ? "No contacts match your search." : "No contacts yet."}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-navy/8 bg-white">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy/8 text-left text-xs font-bold uppercase tracking-widest text-ink-soft">
                <th className="px-5 py-3">Name / Email</th>
                <th className="px-5 py-3">Company</th>
                <th className="px-5 py-3">Tags</th>
                <th className="px-5 py-3">Lists</th>
                <th className="px-5 py-3">Source</th>
                <th className="px-5 py-3">Attribution</th>
                <th className="px-5 py-3">Added</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="border-b border-navy/5 hover:bg-cream-panel/40">
                  <td className="px-5 py-3">
                    <Link href={`/admin/contacts/${c.id}`} className="font-semibold text-navy hover:underline">
                      {c.firstName || c.lastName ? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() : c.email}
                    </Link>
                    {(c.firstName || c.lastName) && (
                      <div className="text-xs text-ink-soft">{c.email}</div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-ink-soft">{c.company ?? "—"}</td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.tags.map((t) => (
                        <span key={t} className="rounded-full bg-navy/8 px-2 py-0.5 text-xs font-medium text-navy">
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-center text-ink-soft">{c.listCount}</td>
                  <td className="px-5 py-3 text-ink-soft">{c.source ?? "—"}</td>
                  <td className="px-5 py-3">
                    {c.attributionSource ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ATTR_COLORS[c.attributionSource] ?? "bg-navy/8 text-navy"}`}>
                        {c.attributionSource.charAt(0) + c.attributionSource.slice(1).toLowerCase().replace(/_/g, " ")}
                      </span>
                    ) : (
                      <span className="text-ink-soft">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-ink-soft">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-navy/8 px-5 py-3">
              <span className="text-xs text-ink-soft">
                {start}–{end} of {total.toLocaleString()}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => navigate({ page: page - 1 })}
                  disabled={page <= 1}
                  className="rounded-lg border border-navy/15 px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-cream-panel disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Prev
                </button>
                <span className="flex items-center px-2 text-xs text-ink-soft">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => navigate({ page: page + 1 })}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-navy/15 px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-cream-panel disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

AdminContactsPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;
export default AdminContactsPage;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return { redirect: { destination: "/", permanent: false } };
  }

  const q = typeof ctx.query.q === "string" ? ctx.query.q.trim() : "";
  const attrFilter = typeof ctx.query.attr === "string" ? ctx.query.attr : "";
  const page = Math.max(1, parseInt(typeof ctx.query.page === "string" ? ctx.query.page : "1", 10) || 1);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    ...(q ? {
      OR: [
        { email: { contains: q, mode: "insensitive" } },
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { company: { contains: q, mode: "insensitive" } },
      ],
    } : {}),
    ...(attrFilter ? { attribution: { source: attrFilter } } : {}),
  };

  const [total, contacts] = await Promise.all([
    db.contact.count({ where }),
    db.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        company: true,
        source: true,
        createdAt: true,
        tags: { select: { tag: true } },
        _count: { select: { listMemberships: true } },
        attribution: { select: { source: true } },
      },
    }),
  ]);

  return {
    props: {
      contacts: contacts.map((c) => ({
        id: c.id,
        email: c.email,
        firstName: c.firstName,
        lastName: c.lastName,
        company: c.company,
        source: c.source,
        createdAt: c.createdAt.toISOString(),
        tags: c.tags.map((t) => t.tag),
        listCount: c._count.listMemberships,
        attributionSource: (c.attribution as { source: string } | null)?.source ?? null,
      })),
      total,
      page,
      pageSize: PAGE_SIZE,
      q,
      attrFilter,
    },
  };
};

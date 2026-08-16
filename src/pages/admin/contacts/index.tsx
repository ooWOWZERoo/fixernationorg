import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

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
}

const AdminContactsPage: NextPageWithLayout<Props> = ({ contacts, total }) => {
  const [q, setQ] = useState("");
  const [attrFilter, setAttrFilter] = useState("");

  const filtered = contacts.filter((c) => {
    if (q) {
      const lower = q.toLowerCase();
      if (
        !c.email.includes(lower) &&
        !(c.firstName ?? "").toLowerCase().includes(lower) &&
        !(c.lastName ?? "").toLowerCase().includes(lower) &&
        !(c.company ?? "").toLowerCase().includes(lower)
      ) return false;
    }
    if (attrFilter && c.attributionSource !== attrFilter) return false;
    return true;
  });

  return (
    <>
      <Head><title>Contacts — Admin</title></Head>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-navy">Contacts</h1>
          <p className="mt-0.5 text-sm text-ink-soft">{total} total</p>
        </div>
        <div className="flex gap-2">
          <a
            href="/api/admin/contacts/export"
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
          onChange={(e) => setQ(e.target.value)}
          className="w-full max-w-sm rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
        />
        <select
          value={attrFilter}
          onChange={(e) => setAttrFilter(e.target.value)}
          className="rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
        >
          <option value="">All attribution sources</option>
          {ATTRIBUTION_SOURCES.map((s) => (
            <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-navy/8 bg-white p-12 text-center">
          <p className="text-sm text-ink-soft">{q ? "No contacts match your search." : "No contacts yet."}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-navy/8 bg-white">
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
              {filtered.map((c) => (
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

  const contacts = await db.contact.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
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
  });

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
      total: contacts.length,
    },
  };
};

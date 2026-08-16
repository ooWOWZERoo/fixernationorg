import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

interface ContactRow {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  notes: string | null;
  createdAt: string;
}

interface Props {
  initialContacts: ContactRow[];
}

const ProviderContactsPage: NextPageWithLayout<Props> = ({ initialContacts }) => {
  const [contacts, setContacts] = useState<ContactRow[]>(initialContacts);
  const [showForm, setShowForm] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setNotes("");
    setFormError(null);
    setShowForm(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/provider/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: firstName || undefined, lastName: lastName || undefined, email, phone: phone || undefined, notes: notes || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Something went wrong.");
      } else {
        setContacts((prev) => [data.contact as ContactRow, ...prev]);
        resetForm();
      }
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from your contacts?`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/provider/contacts/${id}`, { method: "DELETE" });
      if (res.ok) {
        setContacts((prev) => prev.filter((c) => c.id !== id));
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <Head>
        <title>My contacts — Fixer Nation</title>
      </Head>

      <section className="px-6 py-14 lg:px-8">
        <div className="mx-auto max-w-2xl">

          <div className="mb-2 flex flex-wrap items-center gap-3">
            <Link href="/account" className="text-sm font-semibold text-ink-soft no-underline hover:text-navy">
              ← Account
            </Link>
            <span className="text-ink-soft/40">·</span>
            <Link href="/account/provider/campaigns" className="text-sm font-semibold text-ink-soft no-underline hover:text-navy">
              My campaigns
            </Link>
          </div>

          <div className="mt-4 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-navy">My contacts</h1>
              <p className="mt-1 text-sm text-ink-soft">{contacts.length} contact{contacts.length !== 1 ? "s" : ""}</p>
            </div>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="shrink-0 rounded-xl bg-amber px-4 py-2 text-sm font-bold text-navy-dark hover:bg-amber-dark"
              >
                + Add contact
              </button>
            )}
          </div>

          {showForm && (
            <form onSubmit={handleAdd} className="mt-6 rounded-2xl border border-navy/8 bg-white p-6 space-y-4">
              <h2 className="text-base font-extrabold text-navy">Add a contact</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-navy">First name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    maxLength={100}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-navy">Last name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    maxLength={100}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-navy">Email <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={255}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-navy">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={30}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-navy">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={2000}
                  rows={2}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                />
              </div>
              {formError && <p className="text-sm font-semibold text-red-600">{formError}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-navy px-5 py-2 text-sm font-bold text-white hover:bg-navy-dark disabled:opacity-50"
                >
                  {saving ? "Adding…" : "Add contact"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-navy/15 px-5 py-2 text-sm font-bold text-ink-soft hover:bg-cream-panel"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="mt-6">
            {contacts.length === 0 ? (
              <div className="rounded-2xl border border-navy/8 bg-white p-12 text-center">
                <p className="text-sm text-ink-soft">No contacts yet. Add someone to get started.</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-navy/8 bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-navy/8 text-left text-xs font-bold uppercase tracking-widest text-ink-soft">
                      <th className="px-5 py-3">Name / Email</th>
                      <th className="px-5 py-3">Phone</th>
                      <th className="px-5 py-3">Added</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((c) => {
                      const displayName = [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email;
                      return (
                        <tr key={c.id} className="border-b border-navy/5 last:border-0">
                          <td className="px-5 py-3">
                            <p className="font-semibold text-navy">{displayName}</p>
                            {(c.firstName || c.lastName) && (
                              <p className="text-xs text-ink-soft">{c.email}</p>
                            )}
                          </td>
                          <td className="px-5 py-3 text-ink-soft">{c.phone ?? "—"}</td>
                          <td className="px-5 py-3 text-ink-soft">
                            {new Date(c.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <button
                              onClick={() => handleDelete(c.id, displayName)}
                              disabled={deletingId === c.id}
                              className="text-xs font-semibold text-red-500 hover:text-red-700 disabled:opacity-40"
                            >
                              {deletingId === c.id ? "Removing…" : "Remove"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </section>
    </>
  );
};

ProviderContactsPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;
export default ProviderContactsPage;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session) {
    return { redirect: { destination: `/signin?callbackUrl=/account/provider/contacts`, permanent: false } };
  }
  if (session.user.role !== "PROVIDER") {
    return { redirect: { destination: "/dashboard", permanent: false } };
  }

  const res = await fetch(`${process.env.NEXTAUTH_URL}/api/provider/contacts`, {
    headers: { cookie: ctx.req.headers.cookie ?? "" },
  });
  const data = res.ok ? await res.json() : { contacts: [] };

  return {
    props: { initialContacts: data.contacts ?? [] },
  };
};

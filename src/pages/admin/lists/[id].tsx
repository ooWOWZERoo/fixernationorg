import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

interface Member { contactId: string; email: string; firstName: string | null; lastName: string | null }
interface SearchResult { id: string; email: string; firstName: string | null; lastName: string | null }
interface Props {
  list: { id: string; name: string; description: string | null; ownerType: string };
  members: Member[];
}

const AdminListDetailPage: NextPageWithLayout<Props> = ({ list, members: initialMembers }) => {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const memberIds = new Set(members.map((m) => m.contactId));

  const [editingHeader, setEditingHeader] = useState(false);
  const [editName, setEditName] = useState(list.name);
  const [editDesc, setEditDesc] = useState(list.description ?? "");
  const [listInfo, setListInfo] = useState({ name: list.name, description: list.description });

  async function saveHeader() {
    if (!editName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/lists/${list.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), description: editDesc.trim() || null }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setListInfo({ name: editName.trim(), description: editDesc.trim() || null });
      setEditingHeader(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally { setSaving(false); }
  }

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/admin/contacts?q=${encodeURIComponent(query.trim())}`);
        const { contacts } = await res.json();
        setResults(contacts ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  async function addContact(match: SearchResult) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/lists/${list.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add-contacts", contactIds: [match.id] }),
      });
      if (!res.ok) throw new Error("Failed to add");
      setMembers((m) => [...m, { contactId: match.id, email: match.email, firstName: match.firstName, lastName: match.lastName }]);
      setQuery("");
      setResults([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally { setSaving(false); }
  }

  async function remove(contactId: string) {
    const res = await fetch(`/api/admin/lists/${list.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove-contact", contactId }),
    });
    if (res.ok) {
      setMembers((m) => m.filter((x) => x.contactId !== contactId));
    }
  }

  async function deleteList() {
    if (!confirm(`Delete list "${listInfo.name}"? This won't delete the contacts themselves.`)) return;
    await fetch(`/api/admin/lists/${list.id}`, { method: "DELETE" });
    router.push("/admin/lists");
  }

  return (
    <>
      <Head><title>{listInfo.name} — Lists Admin</title></Head>
      <div className="mb-4 flex items-center gap-2 text-sm text-ink-soft">
        <a href="/admin/lists" className="hover:underline">Lists</a>
        <span>/</span>
        <span>{listInfo.name}</span>
      </div>

      <div className="mb-6 flex items-start justify-between">
        {editingHeader ? (
          <div className="flex-1 space-y-2 mr-4">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full max-w-sm rounded-xl border border-navy/15 px-4 py-2 text-lg font-extrabold text-navy focus:outline-none focus:ring-2 focus:ring-navy/30"
            />
            <input
              type="text"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="Description (optional)"
              className="w-full max-w-sm rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
            />
            <div className="flex gap-2">
              <button onClick={saveHeader} disabled={saving || !editName.trim()}
                className="rounded-xl bg-navy px-4 py-1.5 text-sm font-bold text-white hover:bg-navy-dark disabled:opacity-60">
                {saving ? "Saving…" : "Save"}
              </button>
              <button onClick={() => { setEditName(listInfo.name); setEditDesc(listInfo.description ?? ""); setEditingHeader(false); }}
                className="rounded-xl border border-navy/15 px-4 py-1.5 text-sm font-semibold text-ink-soft hover:bg-cream-panel">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h1 className="text-2xl font-extrabold text-navy">{listInfo.name}</h1>
            {listInfo.description && <p className="mt-0.5 text-sm text-ink-soft">{listInfo.description}</p>}
            <div className="mt-1 flex items-center gap-3">
              <p className="text-xs text-ink-soft">{members.length} contact{members.length !== 1 ? "s" : ""}</p>
              <button onClick={() => setEditingHeader(true)}
                className="text-xs font-semibold text-navy/60 hover:text-navy">
                Edit name
              </button>
            </div>
          </div>
        )}
        {!editingHeader && (
          <button onClick={deleteList}
            className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
            Delete list
          </button>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {/* Add by name or email */}
      <div className="relative mb-5 max-w-sm">
        <input
          type="text"
          placeholder="Search by name or email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
        />
        {query.trim() && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-navy/15 bg-white shadow-lg">
            {searching ? (
              <p className="px-4 py-3 text-sm text-ink-soft">Searching…</p>
            ) : results.length === 0 ? (
              <p className="px-4 py-3 text-sm text-ink-soft">No contacts found.</p>
            ) : (
              results.map((r) => {
                const alreadyMember = memberIds.has(r.id);
                const name = r.firstName || r.lastName ? `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() : null;
                return (
                  <button
                    key={r.id}
                    type="button"
                    disabled={saving || alreadyMember}
                    onClick={() => addContact(r)}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-cream-panel/60 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span>
                      <span className="font-semibold text-navy">{name ?? r.email}</span>
                      {name && <span className="ml-2 text-xs text-ink-soft">{r.email}</span>}
                    </span>
                    {alreadyMember && <span className="text-xs text-ink-soft">Already added</span>}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {members.length === 0 ? (
        <div className="rounded-2xl border border-navy/8 bg-white p-12 text-center">
          <p className="text-sm text-ink-soft">No contacts on this list yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-navy/8 bg-white">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy/8 text-left text-xs font-bold uppercase tracking-widest text-ink-soft">
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.contactId} className="border-b border-navy/5 hover:bg-cream-panel/40">
                  <td className="px-5 py-3">
                    <a href={`/admin/contacts/${m.contactId}`} className="font-semibold text-navy hover:underline">
                      {m.firstName || m.lastName ? `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim() : m.email}
                    </a>
                    {(m.firstName || m.lastName) && (
                      <div className="text-xs text-ink-soft">{m.email}</div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => remove(m.contactId)}
                      className="text-xs text-red-500 hover:text-red-700">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </>
  );
};

AdminListDetailPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;
export default AdminListDetailPage;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return { redirect: { destination: "/", permanent: false } };
  }

  const { id } = ctx.params as { id: string };
  const list = await db.contactList.findUnique({
    where: { id },
    include: {
      members: {
        include: { contact: { select: { id: true, email: true, firstName: true, lastName: true } } },
        orderBy: { addedAt: "desc" },
      },
    },
  });

  if (!list) return { notFound: true };

  return {
    props: {
      list: { id: list.id, name: list.name, description: list.description, ownerType: list.ownerType },
      members: list.members.map((m) => ({
        contactId: m.contact.id,
        email: m.contact.email,
        firstName: m.contact.firstName,
        lastName: m.contact.lastName,
      })),
    },
  };
};

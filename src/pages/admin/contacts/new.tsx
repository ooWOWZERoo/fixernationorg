import Head from "next/head";
import { useRouter } from "next/router";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

const AdminNewContactPage: NextPageWithLayout = () => {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "", phone: "", phone2: "", email2: "", company: "", source: "admin" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? data.error ?? "Failed to create contact");
      }
      const contact = await res.json();
      router.push(`/admin/contacts/${contact.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  }

  return (
    <>
      <Head><title>New Contact — Admin</title></Head>
      <div className="mx-auto max-w-lg">
        <h1 className="mb-6 text-2xl font-extrabold text-navy">New contact</h1>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-navy/8 bg-white p-6">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Email *</label>
            <input required type="email" value={form.email} onChange={set("email")}
              className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">First name</label>
              <input type="text" value={form.firstName} onChange={set("firstName")}
                className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Last name</label>
              <input type="text" value={form.lastName} onChange={set("lastName")}
                className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Phone</label>
              <input type="tel" value={form.phone} onChange={set("phone")}
                className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Phone 2</label>
              <input type="tel" value={form.phone2} onChange={set("phone2")}
                className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Email 2</label>
            <input type="email" value={form.email2} onChange={set("email2")}
              className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Company</label>
            <input type="text" value={form.company} onChange={set("company")}
              className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="rounded-xl bg-navy px-5 py-2.5 text-sm font-bold text-white hover:bg-navy-dark disabled:opacity-60">
              {saving ? "Saving…" : "Create contact"}
            </button>
            <a href="/admin/contacts" className="rounded-xl border border-navy/15 px-5 py-2.5 text-sm font-bold text-ink-soft hover:bg-cream-panel no-underline">
              Cancel
            </a>
          </div>
        </form>
      </div>
    </>
  );
};

AdminNewContactPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;
export default AdminNewContactPage;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return { redirect: { destination: "/", permanent: false } };
  }
  return { props: {} };
};

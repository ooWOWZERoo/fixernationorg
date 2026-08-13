import { useState, useEffect } from "react";
import { useRouter } from "next/router";

type GroupFormValues = {
  name: string;
  slug: string;
  description: string;
  coverUrl: string;
  autoMember: boolean;
  autoAmbassador: boolean;
  autoProvider: boolean;
  visibility: string;
};

interface Props {
  initial?: Partial<GroupFormValues> & { autoMember?: boolean; autoAmbassador?: boolean; autoProvider?: boolean };
  groupId?: string;
  mode: "create" | "edit";
}

function toSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function GroupForm({ initial, groupId, mode }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<GroupFormValues>({
    name: initial?.name ?? "",
    slug: initial?.slug ?? "",
    description: initial?.description ?? "",
    coverUrl: initial?.coverUrl ?? "",
    autoMember: initial?.autoMember ?? false,
    autoAmbassador: initial?.autoAmbassador ?? false,
    autoProvider: initial?.autoProvider ?? false,
    visibility: initial?.visibility ?? "PUBLIC",
  });
  const [slugManual, setSlugManual] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slugManual) setValues((v) => ({ ...v, slug: toSlug(v.name) }));
  }, [values.name, slugManual]);

  const set = (field: keyof GroupFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (field === "slug") setSlugManual(true);
    setValues((v) => ({ ...v, [field]: e.target.value }));
  };

  const toggle = (field: "autoMember" | "autoAmbassador" | "autoProvider") => () => {
    setValues((v) => ({ ...v, [field]: !v[field] }));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const url = mode === "create" ? "/api/admin/groups" : `/api/admin/groups/${groupId}`;
    const method = mode === "create" ? "POST" : "PUT";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      router.push("/admin/groups");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!groupId) return;
    if (!confirm("Delete this group and all its posts? This cannot be undone.")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/groups/${groupId}`, { method: "DELETE" });
      if (res.ok) router.push("/admin/groups");
      else setError("Delete failed.");
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-5">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">Name</label>
        <input
          required
          value={values.name}
          onChange={set("name")}
          placeholder="FN Positivity Network"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">Slug</label>
        <input
          required
          value={values.slug}
          onChange={set("slug")}
          placeholder="fn-positivity-network"
          pattern="[a-z0-9-]+"
          title="Lowercase letters, numbers, and hyphens only."
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
        />
        <p className="mt-1 text-xs text-slate-400">
          URL: /network/groups/{values.slug || "…"}
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">Description</label>
        <textarea
          rows={3}
          value={values.description}
          onChange={set("description")}
          placeholder="What is this group about?"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">Cover image URL</label>
        <input
          value={values.coverUrl}
          onChange={set("coverUrl")}
          type="url"
          placeholder="https://..."
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">Visibility</label>
        <select
          value={values.visibility}
          onChange={set("visibility")}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
        >
          <option value="PUBLIC">Public</option>
          <option value="PRIVATE">Private</option>
        </select>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Auto-join</p>
        <p className="mb-3 text-xs text-slate-400">Users with matching roles are added automatically when their role is assigned.</p>
        <div className="space-y-2">
          {(
            [
              { field: "autoMember", label: "Members" },
              { field: "autoAmbassador", label: "Ambassadors" },
              { field: "autoProvider", label: "Service Providers" },
            ] as const
          ).map(({ field, label }) => (
            <label key={field} className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={values[field]}
                onChange={toggle(field)}
                className="h-4 w-4 rounded border-slate-300 accent-navy"
              />
              <span className="text-sm text-slate-700">{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-slate-200 pt-4">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy-dark disabled:opacity-50"
        >
          {saving ? "Saving…" : mode === "create" ? "Create Group" : "Save Changes"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/groups")}
          className="rounded-lg border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          Cancel
        </button>
        {mode === "edit" && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving}
            className="ml-auto rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-500 transition-colors hover:bg-red-50 disabled:opacity-40"
          >
            Delete Group
          </button>
        )}
      </div>
    </form>
  );
}

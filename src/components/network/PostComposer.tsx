import { useState, useRef } from "react";
import type { PostData, Attachment } from "./PostCard";

interface Props {
  groupSlug: string;
  authorName: string | null;
  onPosted: (post: PostData) => void;
}

export function PostComposer({ groupSlug, authorName, onPosted }: Props) {
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/network/upload", { method: "POST", body: form });
    setUploading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Upload failed.");
      return;
    }
    const data = await res.json();
    setAttachments((prev) => [...prev, data]);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || submitting) return;
    setError(null);
    setSubmitting(true);

    const res = await fetch(`/api/network/groups/${groupSlug}/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, attachments: attachments.length ? attachments : undefined }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Post failed.");
      setSubmitting(false);
      return;
    }

    const post = await res.json();
    onPosted(post);
    setBody("");
    setAttachments([]);
    setSubmitting(false);
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-[0_12px_26px_-20px_rgba(20,40,56,0.18)]">
      <form onSubmit={handleSubmit}>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={`Share something with the group, ${authorName?.split(" ")[0] ?? "friend"}…`}
          rows={3}
          className="w-full resize-none rounded-xl border border-slate-200 bg-cream px-4 py-3 text-sm text-ink placeholder-ink-soft focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
        />

        {attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {attachments.map((a, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt={a.name} className="h-20 w-20 rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-white text-xs hover:bg-red-600"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading || attachments.length >= 4}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
          >
            {uploading ? "Uploading…" : "📎 Photo"}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

          <button
            type="submit"
            disabled={!body.trim() || submitting || uploading}
            className="rounded-lg bg-navy px-5 py-1.5 text-xs font-semibold text-white hover:bg-navy-dark disabled:opacity-40 transition-colors"
          >
            {submitting ? "Posting…" : "Post"}
          </button>
        </div>
      </form>
    </div>
  );
}

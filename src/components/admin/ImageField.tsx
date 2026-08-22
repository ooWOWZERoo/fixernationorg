import { useState, useRef } from "react";

interface ImageFieldProps {
  value: string;
  onChange: (url: string) => void;
  uploadEndpoint?: string;
  label?: string;
}

export function ImageField({
  value,
  onChange,
  uploadEndpoint = "/api/admin/morning-boost/upload",
  label = "Cover Image",
}: ImageFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(uploadEndpoint, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error ?? "Upload failed.");
      } else {
        onChange(data.url);
      }
    } catch {
      setUploadError("Network error during upload.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label} <span className="font-normal text-slate-400">(optional)</span>
      </label>

      {/* File picker */}
      <div className="mb-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          {uploading ? "Uploading…" : "Choose file"}
        </button>
        <span className="text-xs text-slate-400">JPEG, PNG, GIF or WebP · max 5 MB</span>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleFile}
        />
      </div>
      {uploadError && <p className="mb-2 text-xs text-red-600">{uploadError}</p>}

      {/* URL fallback */}
      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="or paste an image URL…"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
      />

      {/* Preview */}
      {value && (
        <div className="mt-2 flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Preview" className="h-20 w-28 rounded-lg object-cover border border-slate-200" />
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-xs text-slate-400 hover:text-red-600"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
